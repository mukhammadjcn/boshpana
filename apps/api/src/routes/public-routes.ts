import { CardType } from "@prisma/client";
import { FastifyInstance } from "fastify";

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
  }>("/api/rooms/create", async (request, reply) => {
    try {
      const result = await deps.gameService.createRoom(request.body);
      return reply.send(result);
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

  app.post<{
    Params: { code: string };
    Body: {
      name: string;
      sessionId: string;
    };
  }>("/api/rooms/:code/join", async (request, reply) => {
    try {
      const result = await deps.gameService.joinRoom({
        code: request.params.code,
        ...request.body
      });
      return reply.send(result);
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

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
