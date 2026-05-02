import { BunkerCardType } from "@prisma/client";
import { FastifyInstance } from "fastify";

import { requireAuth } from "../lib/auth-decorator";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import { countHostedRoomsLast30d } from "../services/auth-service";
import { GameRegistry } from "../games/registry";

type RouteDeps = {
  games: GameRegistry;
};

export async function registerPublicRoutes(app: FastifyInstance, deps: RouteDeps) {
  app.get("/health", async () => ({ ok: true }));

  app.post<{
    Body: {
      hostName: string;
      sessionId: string;
      winnerTarget: number;
      maxPlayers?: number;
      isAdult?: boolean;
    };
  }>(
    "/api/rooms/create",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const user = request.authUser!;
        const recentCount = await countHostedRoomsLast30d(user.id);
        if (recentCount >= env.roomCreationLimit) {
          return reply.status(429).send({
            message: `Limit yetdi: 30 kunda ${env.roomCreationLimit} ta xonadan ortiq yarata olmaysiz.`
          });
        }

        const result = await deps.games.bunker.createRoom({
          ...request.body,
          hostUserId: user.id
        });
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post<{
    Params: { code: string };
    Body: {
      name: string;
      sessionId: string;
    };
  }>(
    "/api/rooms/:code/join",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const result = await deps.games.bunker.joinRoom({
          code: request.params.code,
          ...request.body,
          userId: request.authUserId
        });
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({ message: (error as Error).message });
      }
    }
  );

  // Lightweight, game-agnostic room metadata. The frontend room/game pages
  // call this first so they can route to the correct per-game experience
  // (Bunker / Mafia / ...) before fetching the full game state.
  app.get<{ Params: { code: string } }>(
    "/api/rooms/:code/info",
    async (request, reply) => {
      const room = await prisma.room.findUnique({
        where: { code: request.params.code.toUpperCase() },
        select: { code: true, gameType: true, status: true }
      });
      if (!room) {
        return reply.status(404).send({ message: "Xona topilmadi." });
      }
      return reply.send(room);
    }
  );

  app.get<{
    Params: { code: string };
    Querystring: { sessionId: string };
  }>("/api/rooms/:code/state", async (request, reply) => {
    try {
      const result = await deps.games.bunker.getRoomState(
        request.params.code,
        request.query.sessionId
      );
      return reply.send(result);
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get("/api/meta/card-types", async () => ({
    items: BunkerCardType
  }));
}
