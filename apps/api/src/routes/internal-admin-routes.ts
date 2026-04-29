import { FastifyInstance } from "fastify";

import { env } from "../lib/env";
import { prisma } from "../lib/prisma";

type AdminDelegate = {
  findMany: (args?: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

const adminModelConfig: Record<
  string,
  {
    delegate: AdminDelegate;
    include?: Record<string, boolean>;
    orderBy?: Record<string, "asc" | "desc">;
  }
> = {
  users: {
    delegate: prisma.user as AdminDelegate,
    include: undefined,
    orderBy: { createdAt: "desc" as const }
  },
  rooms: {
    delegate: prisma.room as AdminDelegate,
    include: { players: true, game: true, votes: true },
    orderBy: { createdAt: "desc" as const }
  },
  players: {
    delegate: prisma.player as AdminDelegate,
    include: { attributes: true },
    orderBy: { joinedAt: "desc" as const }
  },
  games: {
    delegate: prisma.game as AdminDelegate,
    include: { disaster: true, currentSituation: true, playerAttributes: true },
    orderBy: { createdAt: "desc" as const }
  },
  playerAttributes: {
    delegate: prisma.playerAttribute as AdminDelegate,
    include: { player: true, game: true },
    orderBy: { id: "desc" as const }
  },
  votes: {
    delegate: prisma.vote as AdminDelegate,
    include: { voterPlayer: true, targetPlayer: true, room: true },
    orderBy: { createdAt: "desc" as const }
  },
  cards: {
    delegate: prisma.card as AdminDelegate,
    include: undefined,
    orderBy: { updatedAt: "desc" as const }
  },
  disasters: {
    delegate: prisma.disaster as AdminDelegate,
    include: undefined,
    orderBy: { updatedAt: "desc" as const }
  },
  situations: {
    delegate: prisma.situation as AdminDelegate,
    include: undefined,
    orderBy: { updatedAt: "desc" as const }
  }
};

function getModelOrThrow(model: string) {
  const entry = adminModelConfig[model as keyof typeof adminModelConfig];

  if (!entry) {
    throw new Error("Noma'lum model.");
  }

  return entry;
}

export async function registerInternalAdminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/internal/admin")) {
      return;
    }

    if (request.headers["x-admin-secret"] !== env.adminSecret) {
      return reply.status(401).send({ message: "Admin ruxsati yo'q." });
    }
  });

  app.get("/internal/admin/schema", async (_request, reply) => {
    return reply.send({
      models: Object.keys(adminModelConfig)
    });
  });

  app.get("/internal/admin/stats", async (_request, reply) => {
    try {
      const [
        totalUsers,
        totalRooms,
        finishedRooms,
        cancelledRooms,
        playingRooms,
        gamesStarted,
        avgDurationGroup
      ] = await Promise.all([
        prisma.user.count(),
        prisma.room.count(),
        prisma.room.count({ where: { status: "FINISHED" } }),
        prisma.room.count({ where: { status: "CANCELLED" } }),
        prisma.room.count({ where: { status: "PLAYING" } }),
        prisma.game.count({ where: { startedAt: { not: null } } }),
        prisma.gameHistory.findMany({
          where: {
            durationSeconds: { not: null },
            outcome: { not: "CANCELLED" }
          },
          distinct: ["roomCode", "playedAt"],
          select: { durationSeconds: true }
        })
      ]);

      const durations = avgDurationGroup
        .map((row) => row.durationSeconds ?? 0)
        .filter((n) => n > 0);
      const avgDurationSeconds = durations.length
        ? Math.round(
            durations.reduce((sum, n) => sum + n, 0) / durations.length
          )
        : 0;

      return reply.send({
        totalUsers,
        totalRooms,
        finishedRooms,
        cancelledRooms,
        playingRooms,
        gamesStarted,
        avgDurationSeconds,
        avgDurationMinutes:
          avgDurationSeconds > 0
            ? Math.round((avgDurationSeconds / 60) * 10) / 10
            : 0,
        finishedGamesCounted: durations.length
      });
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

  app.get<{
    Params: { model: string };
  }>("/internal/admin/:model", async (request, reply) => {
    try {
      const model = getModelOrThrow(request.params.model);
      const items = await model.delegate.findMany({
        include: model.include,
        orderBy: model.orderBy
      });
      return reply.send({ items });
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

  app.post<{
    Params: { model: string };
    Body: Record<string, unknown>;
  }>("/internal/admin/:model", async (request, reply) => {
    try {
      const model = getModelOrThrow(request.params.model);
      const item = await model.delegate.create({
        data: request.body
      });
      return reply.send({ item });
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

  app.patch<{
    Params: { model: string; id: string };
    Body: Record<string, unknown>;
  }>("/internal/admin/:model/:id", async (request, reply) => {
    try {
      const model = getModelOrThrow(request.params.model);
      const item = await model.delegate.update({
        where: { id: request.params.id },
        data: request.body
      });
      return reply.send({ item });
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });

  app.delete<{
    Params: { model: string; id: string };
  }>("/internal/admin/:model/:id", async (request, reply) => {
    try {
      const model = getModelOrThrow(request.params.model);
      await model.delegate.delete({
        where: { id: request.params.id }
      });
      return reply.send({ ok: true });
    } catch (error) {
      return reply.status(400).send({ message: (error as Error).message });
    }
  });
}
