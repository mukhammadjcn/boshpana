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
import { GameService } from "./services/game-service";
import { RealtimeHub } from "./socket/realtime-hub";

async function bootstrap() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  // Eagerly initialise the Redis connection so failures surface at boot
  // rather than on the first auth-session call.
  getRedis();

  const gameService = new GameService();
  gameService.startCleanupSweeper();
  await registerAuthRoutes(app);
  await registerPublicRoutes(app, { gameService });
  await registerInternalAdminRoutes(app);

  const io = new Server(app.server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  const realtimeHub = new RealtimeHub(io, gameService);
  gameService.setRealtime(realtimeHub);
  realtimeHub.register();

  void startTelegramBot();

  const shutdown = async () => {
    await stopTelegramBot();
    await gameService.shutdown();
    await closeRedis();
    await prisma.$disconnect();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

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
