import { CardType } from "@prisma/client";
import { FastifyInstance } from "fastify";

import { attachAuthUser, requireAuth } from "../lib/auth-decorator";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import { GameService } from "../services/game-service";

type RouteDeps = {
  gameService: GameService;
};

export async function registerPublicRoutes(app: FastifyInstance, deps: RouteDeps) {
  app.get("/health", async () => ({ ok: true }));

  app.post<{
    Body: {
      hostName: string;
      sessionId: string;
      winnerTarget: number;
      maxPlayers?: number;
    };
  }>(
    "/api/rooms/create",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const user = request.authUser!;
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentCount = await prisma.room.count({
          where: { hostUserId: user.id, createdAt: { gte: since } }
        });
        if (recentCount >= env.roomCreationLimit) {
          return reply.status(429).send({
            message: `Limit yetdi: 30 kunda ${env.roomCreationLimit} ta xonadan ortiq yarata olmaysiz.`
          });
        }

        const result = await deps.gameService.createRoom({
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
    { preHandler: attachAuthUser },
    async (request, reply) => {
      try {
        const result = await deps.gameService.joinRoom({
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

  app.get<{
    Params: { code: string };
    Querystring: { sessionId: string };
  }>("/api/rooms/:code/state", async (request, reply) => {
    try {
      const result = await deps.gameService.getRoomState(
        request.params.code,
        request.query.sessionId
      );
      return reply.send(result);
    } catch (error) {
      return reply.status(404).send({ message: (error as Error).message });
    }
  });

  app.get("/api/meta/card-types", async () => ({
    items: CardType
  }));
}
