import cors from "@fastify/cors";
import Fastify from "fastify";
import { Server } from "socket.io";

import { startTelegramBot, stopTelegramBot } from "./bot/bot-service";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";
import { closeRedis, getRedis } from "./lib/redis";
import { registerAuthRoutes } from "./routes/auth-routes";
import { registerInternalAdminRoutes } from "./routes/internal-admin-routes";
import { registerPublicRoutes } from "./routes/public-routes";
import { GameRegistry } from "./games/registry";
import { RealtimeHub } from "./socket/realtime-hub";

async function bootstrap() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Language"]
  });

  // Eagerly initialise the Redis connection so failures surface at boot
  // rather than on the first auth-session call.
  getRedis();

  const games = new GameRegistry();
  games.startCleanupSweeper();
  await registerAuthRoutes(app);
  await registerPublicRoutes(app, { games });
  await registerInternalAdminRoutes(app);

  const io = new Server(app.server, {
    cors: {
      origin: true,
      credentials: true
    },
    // Tighten heartbeat so we detect a dropped client within ~10s
    // (default 25s + 20s = 45s is too sluggish for a presence-driven
    // lobby UI). Pairs with the client's 2s reconnection delay.
    pingInterval: 5000,
    pingTimeout: 5000
  });

  const realtimeHub = new RealtimeHub(io, games);
  games.setRealtime(realtimeHub);
  realtimeHub.register();

  // Restart timers for any rooms that were mid-round when the previous
  // process exited. Must run AFTER setRealtime so resolution paths can
  // broadcast the catch-up state. Any failure here shouldn't block boot
  // — the cleanup sweeper will eventually reap stalled rooms anyway.
  void games.resumeTimers().catch((error) => {
    app.log.error({ err: error }, "resumeTimers failed");
  });

  void startTelegramBot();

  // Graceful shutdown:
  //   • guard against repeat signals — SIGTERM during a slow drain would
  //     otherwise re-enter and double-close resources;
  //   • close socket.io and the HTTP server first so no new requests
  //     come in while we're flushing state;
  //   • cap the whole drain at SHUTDOWN_TIMEOUT_MS so a hung client
  //     can't pin the process forever (k8s would SIGKILL anyway, but a
  //     clean exit code keeps logs readable).
  const SHUTDOWN_TIMEOUT_MS = 10_000;
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "graceful shutdown started");

    const force = setTimeout(() => {
      app.log.warn("shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    try {
      io.close();
      await app.close();
      await stopTelegramBot();
      await games.shutdown();
      await closeRedis();
      await prisma.$disconnect();
      app.log.info("graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "shutdown failed");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({
    port: env.port,
    host: "0.0.0.0"
  });
}

bootstrap().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
