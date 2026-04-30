// Redis-backed store for browser-initiated bot login sessions.
//
// Mirrors the dasyor pattern: the browser asks for a session, gets back
// a short hash that gets embedded in a `t.me/{bot}?start=auth_{hash}`
// link. When the user opens that link in Telegram, the bot looks up the
// session by hash, optionally collects a phone number, and marks the
// session confirmed. The browser polls /status until confirmed, then
// trades the session token for a JWT.
//
// Keys:
//   auth_session:{token}        -> JSON session       (TTL 300s)
//   auth_session:hash:{botHash} -> token              (TTL 300s)
//   auth_session:chat:{tgChatId}-> token              (TTL 300s)

import crypto from "node:crypto";

import { getRedis } from "../lib/redis";

export type AuthSessionStatus =
  | "pending"
  | "needs_phone"
  | "confirmed"
  | "rejected";

export type AuthSession = {
  token: string;
  botHash: string;
  status: AuthSessionStatus;
  userId: string | null;
  tgChatId: string | null;
  payload: { redirect?: string };
  createdAt: number;
  expiresAt: number;
};

const TTL_SECONDS = 300;

const PREFIX = "auth_session:";
const TOKEN_KEY = (token: string) => `${PREFIX}${token}`;
const HASH_KEY = (hash: string) => `${PREFIX}hash:${hash}`;
const CHAT_KEY = (chatId: string) => `${PREFIX}chat:${chatId}`;

function newToken(): string {
  return crypto.randomUUID();
}

function newBotHash(): string {
  return crypto.randomBytes(12).toString("base64url");
}

async function readSession(token: string): Promise<AuthSession | null> {
  const redis = getRedis();
  const raw = await redis.get(TOKEN_KEY(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

async function writeSession(session: AuthSession, ttl?: number): Promise<void> {
  const redis = getRedis();
  const remaining =
    ttl ?? Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000));
  await redis.set(TOKEN_KEY(session.token), JSON.stringify(session), "EX", remaining);
}

export async function createAuthSession(
  payload: { redirect?: string } = {}
): Promise<AuthSession> {
  const redis = getRedis();
  let token = newToken();
  while ((await redis.exists(TOKEN_KEY(token))) === 1) token = newToken();
  let botHash = newBotHash();
  while ((await redis.exists(HASH_KEY(botHash))) === 1) botHash = newBotHash();

  const now = Date.now();
  const session: AuthSession = {
    token,
    botHash,
    status: "pending",
    userId: null,
    tgChatId: null,
    payload,
    createdAt: now,
    expiresAt: now + TTL_SECONDS * 1000
  };

  // Write the canonical record + the hash → token index in one round-trip.
  await Promise.all([
    redis.set(TOKEN_KEY(token), JSON.stringify(session), "EX", TTL_SECONDS),
    redis.set(HASH_KEY(botHash), token, "EX", TTL_SECONDS)
  ]);
  return session;
}

export async function getAuthSession(token: string): Promise<AuthSession | null> {
  return readSession(token);
}

export async function getAuthSessionByBotHash(
  hash: string
): Promise<AuthSession | null> {
  const redis = getRedis();
  const token = await redis.get(HASH_KEY(hash));
  if (!token) return null;
  return readSession(token);
}

export async function getAuthSessionByChatId(
  chatId: string
): Promise<AuthSession | null> {
  const redis = getRedis();
  const token = await redis.get(CHAT_KEY(chatId));
  if (!token) return null;
  const session = await readSession(token);
  // Defensive: if the session no longer points to this chat, ignore.
  if (!session || session.tgChatId !== chatId) return null;
  return session;
}

export async function bindChatToSession(
  token: string,
  chatId: string
): Promise<AuthSession | null> {
  const redis = getRedis();
  const session = await readSession(token);
  if (!session) return null;
  session.tgChatId = chatId;
  // Drop a stale chat→token mapping for this chat (different session).
  const existingToken = await redis.get(CHAT_KEY(chatId));
  if (existingToken && existingToken !== token) {
    await redis.del(CHAT_KEY(chatId));
  }
  await Promise.all([
    writeSession(session),
    redis.set(CHAT_KEY(chatId), token, "EX", TTL_SECONDS)
  ]);
  return session;
}

export async function updateAuthSession(
  token: string,
  patch: Partial<Pick<AuthSession, "status" | "userId">>
): Promise<AuthSession | null> {
  const session = await readSession(token);
  if (!session) return null;
  if (patch.status !== undefined) session.status = patch.status;
  if (patch.userId !== undefined) session.userId = patch.userId;
  await writeSession(session);
  return session;
}

export async function deleteAuthSession(token: string): Promise<void> {
  const redis = getRedis();
  const session = await readSession(token);
  if (!session) {
    await redis.del(TOKEN_KEY(token));
    return;
  }
  const keys = [TOKEN_KEY(token), HASH_KEY(session.botHash)];
  if (session.tgChatId) keys.push(CHAT_KEY(session.tgChatId));
  await redis.del(...keys);
}

// Redis handles TTL natively, so a sweeper isn't strictly necessary —
// kept as a no-op for parity with the in-memory implementation.
export function ensureAuthSessionSweeper(): void {
  // intentionally empty
}
