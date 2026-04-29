import type { FastifyInstance } from "fastify";

import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import {
  AuthError,
  publicUser,
  signAccessToken,
  upsertUserFromTelegram,
  verifyTelegramInitData
} from "../services/auth-service";
import { requireAuth } from "../lib/auth-decorator";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: { initData?: string } }>(
    "/api/auth/telegram-webapp",
    async (request, reply) => {
      try {
        const initData = request.body?.initData ?? "";
        const { user: tgUser } = verifyTelegramInitData(initData);
        const existing = await upsertUserFromTelegram(tgUser);

        if (!existing.phone) {
          return reply.send({
            requiresPhone: true,
            user: publicUser(existing)
          });
        }

        const token = signAccessToken(existing.id);
        return reply.send({ token, user: publicUser(existing) });
      } catch (error) {
        const status = error instanceof AuthError ? error.statusCode : 400;
        return reply
          .status(status)
          .send({ message: (error as Error).message });
      }
    }
  );

  app.post<{ Body: { initData?: string; phone?: string } }>(
    "/api/auth/telegram-webapp/phone",
    async (request, reply) => {
      try {
        const { initData, phone } = request.body ?? {};
        if (!phone) {
          throw new AuthError("Telefon raqam majburiy.", 400);
        }
        const normalizedPhone = phone.replace(/[^\d+]/g, "");
        if (normalizedPhone.length < 7) {
          throw new AuthError("Telefon raqam noto'g'ri.", 400);
        }

        const { user: tgUser } = verifyTelegramInitData(initData ?? "");
        const user = await upsertUserFromTelegram(tgUser, normalizedPhone);
        const token = signAccessToken(user.id);
        return reply.send({ token, user: publicUser(user) });
      } catch (error) {
        const status = error instanceof AuthError ? error.statusCode : 400;
        return reply
          .status(status)
          .send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/api/auth/me",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.authUser;
      if (!user) {
        return reply.status(401).send({ message: "Avtorizatsiya talab qilinadi." });
      }
      return reply.send({ user: publicUser(user) });
    }
  );

  app.get(
    "/api/me/usage",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.authUser!;
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const used = await prisma.room.count({
        where: { hostUserId: user.id, createdAt: { gte: since } }
      });
      const limit = env.roomCreationLimit;
      return reply.send({
        roomsCreatedLast30d: used,
        roomCreationLimit: limit,
        remaining: Math.max(0, limit - used)
      });
    }
  );

  app.patch<{ Body: { nickname?: string } }>(
    "/api/me/profile",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.authUser!;
      const raw = (request.body?.nickname ?? "").trim();
      if (!raw) {
        return reply
          .status(400)
          .send({ message: "Nickname bo'sh bo'lmasligi kerak." });
      }
      if (raw.length > 32) {
        return reply
          .status(400)
          .send({ message: "Nickname 32 belgidan oshmasin." });
      }
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { nickname: raw }
      });
      return reply.send({ user: publicUser(updated) });
    }
  );

  app.get(
    "/api/me/active-games",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.authUser!;
      const items = await prisma.player.findMany({
        where: {
          userId: user.id,
          room: {
            status: { in: ["LOBBY", "PLAYING"] }
          }
        },
        include: {
          room: {
            include: {
              game: { include: { disaster: true } }
            }
          }
        },
        orderBy: { joinedAt: "desc" }
      });
      return reply.send({
        items: items.map((p) => ({
          playerId: p.id,
          isHost: p.isHost,
          isAlive: p.isAlive,
          name: p.name,
          room: {
            code: p.room.code,
            status: p.room.status,
            createdAt: p.room.createdAt.toISOString(),
            phase: p.room.game?.phase ?? "LOBBY",
            disasterName: p.room.game?.disaster?.name ?? null
          }
        }))
      });
    }
  );

  app.post<{ Params: { code: string }; Body: { sessionId: string } }>(
    "/api/rooms/:code/resume",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.authUser!;
      const sessionId = request.body?.sessionId;
      if (!sessionId) {
        return reply
          .status(400)
          .send({ message: "sessionId majburiy." });
      }
      const room = await prisma.room.findUnique({
        where: { code: request.params.code.toUpperCase() },
        include: { players: true }
      });
      if (!room) {
        return reply.status(404).send({ message: "Room topilmadi." });
      }
      if (
        room.status !== "LOBBY" &&
        room.status !== "PLAYING"
      ) {
        return reply
          .status(409)
          .send({ message: "Bu o'yin allaqachon yakunlangan." });
      }
      const player = room.players.find((p) => p.userId === user.id);
      if (!player) {
        return reply
          .status(404)
          .send({ message: "Bu xonada sizning o'yinchingiz topilmadi." });
      }
      await prisma.player.update({
        where: { id: player.id },
        data: { sessionId }
      });
      // Host'ning sessionId'sini ham yangilab qo'yamiz, aks holda host
      // huquqlari yo'qoladi.
      if (player.isHost) {
        await prisma.room.update({
          where: { id: room.id },
          data: { hostSessionId: sessionId }
        });
      }
      return reply.send({
        roomCode: room.code,
        playerId: player.id,
        isHost: player.isHost
      });
    }
  );

  app.get<{ Querystring: { limit?: string; cursor?: string } }>(
    "/api/me/games",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.authUser!;
      const limit = Math.min(Math.max(Number(request.query.limit ?? 20), 1), 50);
      const items = await prisma.gameHistory.findMany({
        where: { userId: user.id },
        orderBy: { playedAt: "desc" },
        take: limit + 1,
        ...(request.query.cursor
          ? { cursor: { id: request.query.cursor }, skip: 1 }
          : {})
      });
      const hasMore = items.length > limit;
      const trimmed = hasMore ? items.slice(0, limit) : items;
      return reply.send({
        items: trimmed.map((row) => ({
          id: row.id,
          playedAt: row.playedAt.toISOString(),
          disasterName: row.disasterName,
          outcome: row.outcome,
          roomCode: row.roomCode,
          playerCount: row.playerCount
        })),
        nextCursor: hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null
      });
    }
  );
}
