import type { FastifyInstance } from "fastify";

import { env } from "../lib/env";
import { buildLocalizedText, isLocalizedText } from "../lib/localized-content";
import { prisma } from "../lib/prisma";
import {
  AuthError,
  countHostedRoomsLast30d,
  publicUser,
  signAccessToken,
  upsertUserFromTelegram,
  verifyTelegramInitData
} from "../services/auth-service";
import {
  createAuthSession,
  deleteAuthSession,
  getAuthSession,
  ensureAuthSessionSweeper
} from "../services/auth-session-store";
import { requireAuth } from "../lib/auth-decorator";

function buildBotLink(botHash: string): string | null {
  const username = env.telegramBotUsername;
  if (!username) return null;
  // Always use the chat deep link (?start=...) — not the Mini App
  // (?startapp=...). The bot chat is what surfaces the contact keyboard
  // and the Yes/No confirmation buttons; the WebApp can't run those.
  return `https://t.me/${username}?start=auth_${botHash}`;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  ensureAuthSessionSweeper();

  // Browser asks for a fresh bot-login session. Returns the token (used
  // for polling) and the bot link the user must open in Telegram.
  app.post<{ Body: { redirect?: string } }>(
    "/api/auth/bot-session",
    async (request, reply) => {
      if (!env.telegramBotUsername) {
        return reply
          .status(503)
          .send({ message: "Bot ulanmagan, administratorga murojaat qiling." });
      }
      const redirect = (request.body?.redirect ?? "").trim() || undefined;
      const session = await createAuthSession({ redirect });
      const botLink = buildBotLink(session.botHash);
      return reply.send({
        token: session.token,
        botLink,
        expiresIn: Math.max(
          0,
          Math.floor((session.expiresAt - Date.now()) / 1000)
        )
      });
    }
  );

  // Browser polls this endpoint until status === "confirmed". On success
  // the session is consumed (deleted) and the JWT is returned.
  app.get<{ Params: { token: string } }>(
    "/api/auth/bot-session/:token",
    async (request, reply) => {
      const session = await getAuthSession(request.params.token);
      if (!session) {
        return reply
          .status(404)
          .send({ message: "Sessiya topilmadi yoki muddati tugagan." });
      }
      if (session.status === "confirmed" && session.userId) {
        const user = await prisma.user.findUnique({
          where: { id: session.userId }
        });
        if (!user) {
          await deleteAuthSession(session.token);
          return reply
            .status(404)
            .send({ message: "Foydalanuvchi topilmadi." });
        }
        const token = signAccessToken(user.id);
        await deleteAuthSession(session.token);
        return reply.send({
          status: "confirmed",
          token,
          user: publicUser(user),
          redirect: session.payload.redirect ?? null
        });
      }
      return reply.send({
        status: session.status,
        expiresIn: Math.max(
          0,
          Math.floor((session.expiresAt - Date.now()) / 1000)
        )
      });
    }
  );

  // DEVELOPMENT ONLY. Mounts only when `env.enableDevAuth` is true (off in
  // production). Creates or fetches a fixed local-test user and returns a
  // signed JWT, bypassing the Telegram bot round-trip so devs can log in
  // with one click while iterating on the UI.
  if (env.enableDevAuth) {
    app.post<{ Body: { nickname?: string } }>(
      "/api/auth/dev-login",
      async (request, reply) => {
        const nickname = (request.body?.nickname ?? "").trim() || "Dev";
        const telegramId = `dev-${nickname.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        const user = await prisma.user.upsert({
          where: { telegramId },
          update: { nickname, firstName: nickname },
          create: {
            telegramId,
            firstName: nickname,
            nickname,
            phone: "+0000000000"
          }
        });
        const token = signAccessToken(user.id);
        return reply.send({ token, user: publicUser(user) });
      }
    );
  }

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
      const used = await countHostedRoomsLast30d(user.id);
      const limit = env.roomCreationLimit;
      return reply.send({
        roomsCreatedLast30d: used,
        roomCreationLimit: limit,
        remaining: Math.max(0, limit - used)
      });
    }
  );

  app.patch<{ Body: { nickname?: string; languageCode?: string | null } }>(
    "/api/me/profile",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.authUser!;
      const nicknameInput = request.body?.nickname;
      const raw = typeof nicknameInput === "string" ? nicknameInput.trim() : undefined;
      const languageCodeInput = request.body?.languageCode;
      const normalizedLanguageCode =
        typeof languageCodeInput === "string"
          ? languageCodeInput.trim().toLowerCase()
          : null;

      if (raw !== undefined && !raw) {
        return reply
          .status(400)
          .send({ message: "Nickname bo'sh bo'lmasligi kerak." });
      }
      if (raw && raw.length > 32) {
        return reply
          .status(400)
          .send({ message: "Nickname 32 belgidan oshmasin." });
      }
      if (
        normalizedLanguageCode !== null &&
        !["uz", "ru", "en"].includes(normalizedLanguageCode)
      ) {
        return reply
          .status(400)
          .send({ message: "Til noto'g'ri." });
      }

      const data: { nickname?: string; languageCode?: string | null } = {};
      if (raw) {
        data.nickname = raw;
      }
      if (normalizedLanguageCode !== null) {
        data.languageCode = normalizedLanguageCode;
      }
      if (!Object.keys(data).length) {
        return reply
          .status(400)
          .send({ message: "Yangilash uchun kamida bitta maydon yuboring." });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data
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
              bunkerGame: { include: { disaster: true } },
              mafiaGame: true
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
            gameType: p.room.gameType,
            status: p.room.status,
            createdAt: p.room.createdAt.toISOString(),
            phase:
              p.room.gameType === "MAFIA"
                ? (p.room.mafiaGame?.phase ?? "LOBBY")
                : (p.room.bunkerGame?.phase ?? "LOBBY"),
            disasterName: p.room.bunkerGame?.disaster
              ? buildLocalizedText(
                  p.room.bunkerGame.disaster.name,
                  p.room.bunkerGame.disaster.nameRu,
                  p.room.bunkerGame.disaster.nameEn
                )
              : null
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

  app.get<{ Querystring: { page?: string; pageSize?: string } }>(
    "/api/me/games",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.authUser!;
      const pageSize = Math.min(
        Math.max(Number(request.query.pageSize ?? 10), 1),
        50
      );
      const page = Math.max(Number(request.query.page ?? 1), 1);
      const where = { userId: user.id };
      const [total, items] = await Promise.all([
        prisma.gameHistory.count({ where }),
        prisma.gameHistory.findMany({
          where,
          orderBy: { playedAt: "desc" },
          take: pageSize,
          skip: (page - 1) * pageSize
        })
      ]);
      return reply.send({
        items: items.map((row) => {
          const meta = (row.metadata ?? null) as Record<string, unknown> | null;
          const localizedDisasterName = meta?.disasterNameI18n;
          const legacyDisasterName = meta?.disasterName;
          return {
            id: row.id,
            gameType: row.gameType,
            playedAt: row.playedAt.toISOString(),
            disasterName:
              isLocalizedText(localizedDisasterName)
                ? localizedDisasterName
                : typeof legacyDisasterName === "string"
                  ? buildLocalizedText(legacyDisasterName)
                  : null,
            outcome: row.outcome,
            roomCode: row.roomCode,
            playerCount: row.playerCount
          };
        }),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      });
    }
  );
}
