import crypto from "node:crypto";

import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

import { env } from "../lib/env";
import { prisma } from "../lib/prisma";

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
};

export type ParsedInitData = {
  user: TelegramWebAppUser;
  authDate: number;
  rawUser: string;
};

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
  }
}

export function verifyTelegramInitData(initData: string): ParsedInitData {
  if (!env.telegramBotToken) {
    throw new AuthError("TELEGRAM_BOT_TOKEN sozlanmagan.", 500);
  }
  if (!initData) {
    throw new AuthError("initData majburiy.");
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) {
    throw new AuthError("initData hash topilmadi.");
  }
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => [k, v] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(env.telegramBotToken)
    .digest();
  const calculatedHash = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  if (
    calculatedHash.length !== receivedHash.length ||
    !crypto.timingSafeEqual(
      Buffer.from(calculatedHash, "hex"),
      Buffer.from(receivedHash, "hex")
    )
  ) {
    throw new AuthError("initData hash xato.");
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  if (
    !authDate ||
    Math.floor(Date.now() / 1000) - authDate > env.telegramAuthMaxAgeSeconds
  ) {
    throw new AuthError("Telegram sessiyasi eskirgan, qayta oching.");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new AuthError("initData ichida user topilmadi.");
  }

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    throw new AuthError("initData user JSON noto'g'ri.");
  }

  if (!user.id) {
    throw new AuthError("Telegram user id topilmadi.");
  }

  return { user, authDate, rawUser: userRaw };
}

export async function upsertUserFromTelegram(
  tgUser: TelegramWebAppUser,
  phone?: string
) {
  const updateData: Record<string, unknown> = {
    telegramUsername: tgUser.username ?? null,
    firstName: tgUser.first_name ?? null,
    lastName: tgUser.last_name ?? null,
    languageCode: tgUser.language_code ?? null,
    isPremium: !!tgUser.is_premium,
    ...(phone ? { phone } : {})
  };
  // Only overwrite photoUrl when the source actually has one (bot
  // updates don't carry photo_url, only the WebApp initData does).
  if (tgUser.photo_url !== undefined) {
    updateData.photoUrl = tgUser.photo_url ?? null;
  }

  // Default nickname seeds from Telegram first_name (or username) on the
  // very first upsert. Subsequent upserts never overwrite a nickname the
  // user may have customized.
  const defaultNickname =
    tgUser.first_name?.trim() ||
    tgUser.username?.trim() ||
    `user${tgUser.id}`;

  return prisma.user.upsert({
    where: { telegramId: String(tgUser.id) },
    create: {
      telegramId: String(tgUser.id),
      nickname: defaultNickname,
      ...updateData
    },
    update: updateData
  });
}

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: env.jwtAccessTtl as SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") {
      throw new AuthError("Token sub mavjud emas.");
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Token noto'g'ri yoki muddati o'tgan.");
  }
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

// Count how many rooms this user has hosted in the last 30 days.
//
// We can't just count Room rows because the cleanup sweeper deletes
// FINISHED/CANCELLED rooms 30 minutes after they end — so yesterday's
// games disappear from Room and the limit appears to "reset" overnight.
//
// GameHistory is durable (1 row per game, attached to the host), so we
// count from there + add active rooms not yet in history. The two sets
// are disjoint: a room is in GameHistory iff it's FINISHED/CANCELLED,
// and we only count LOBBY/PLAYING from Room.
export async function countHostedRoomsLast30d(userId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [historyCount, activeCount] = await Promise.all([
    prisma.gameHistory.count({
      where: { userId, playedAt: { gte: since } }
    }),
    prisma.room.count({
      where: {
        hostUserId: userId,
        status: { in: ["LOBBY", "PLAYING"] },
        createdAt: { gte: since }
      }
    })
  ]);
  return historyCount + activeCount;
}

export function publicUser(
  user: NonNullable<Awaited<ReturnType<typeof findUserById>>>
) {
  return {
    id: user.id,
    telegramId: user.telegramId,
    telegramUsername: user.telegramUsername,
    firstName: user.firstName,
    lastName: user.lastName,
    nickname: user.nickname,
    photoUrl: user.photoUrl,
    phone: user.phone,
    isPremium: user.isPremium
  };
}
