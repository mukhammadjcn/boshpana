import { BunkerCardType, GameType } from "@prisma/client";
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
      gameType?: GameType;
      hostName: string;
      sessionId: string;
      // Bunker-only fields (ignored for Mafia)
      winnerTarget?: number;
      isAdult?: boolean;
      // Mafia-only fields (ignored for Bunker)
      mafiaCount?: number;
      hasSheriff?: boolean;
      hasDoctor?: boolean;
      // Shared
      maxPlayers?: number;
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

        const body = request.body;
        const gameType = body.gameType ?? GameType.BUNKER;

        if (gameType === GameType.MAFIA) {
          const result = await deps.games.mafia.createRoom({
            hostName: body.hostName,
            sessionId: body.sessionId,
            hostUserId: user.id,
            maxPlayers: body.maxPlayers,
            mafiaCount: body.mafiaCount ?? 2,
            hasSheriff: body.hasSheriff ?? true,
            hasDoctor: body.hasDoctor ?? true
          });
          return reply.send(result);
        }

        const result = await deps.games.bunker.createRoom({
          hostName: body.hostName,
          sessionId: body.sessionId,
          hostUserId: user.id,
          maxPlayers: body.maxPlayers,
          winnerTarget: body.winnerTarget ?? 1,
          isAdult: body.isAdult
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
        const code = request.params.code.toUpperCase();
        const room = await prisma.room.findUnique({
          where: { code },
          select: { gameType: true }
        });
        if (!room) {
          return reply.status(404).send({ message: "Xona topilmadi." });
        }
        const service = deps.games.for(room.gameType);
        const result = await service.joinRoom({
          code,
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
      const code = request.params.code.toUpperCase();
      const room = await prisma.room.findUnique({
        where: { code },
        select: { gameType: true }
      });
      if (!room) {
        return reply.status(404).send({ message: "Xona topilmadi." });
      }
      const service = deps.games.for(room.gameType);
      const result = await service.getRoomState(code, request.query.sessionId);
      return reply.send(result);
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get("/api/meta/card-types", async () => ({
    items: BunkerCardType
  }));
}
