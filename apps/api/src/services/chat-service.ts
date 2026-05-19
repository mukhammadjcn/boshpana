import crypto from "node:crypto";

import { getRedis } from "../lib/redis";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  // Mafia: a dead player gets exactly one "last words" message. Tagged
  // so the whole table sees it as their dying statement. Absent on
  // normal messages (kept optional for backward compatibility with
  // messages already in Redis).
  kind?: "last_words";
};

const CHAT_PREFIX = "chat:";
const LAST_WORDS_PREFIX = "chat_lastwords:";
const CHAT_TTL_SECONDS = 6 * 60 * 60;
const CHAT_MAX_MESSAGES = 500;

function roomKey(roomCode: string): string {
  return `${CHAT_PREFIX}${roomCode.toUpperCase()}`;
}

function lastWordsKey(roomCode: string): string {
  return `${LAST_WORDS_PREFIX}${roomCode.toUpperCase()}`;
}

function normalizeText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export const chatService = {
  createMessage(input: {
    senderId: string;
    senderName: string;
    text: string;
    kind?: "last_words";
  }): ChatMessage {
    return {
      id: crypto.randomUUID(),
      senderId: input.senderId,
      senderName: input.senderName,
      text: normalizeText(input.text),
      timestamp: new Date().toISOString(),
      ...(input.kind ? { kind: input.kind } : {})
    };
  },

  // Atomically claim this (dead) player's one-and-only last-words slot
  // in this room. Returns true if the claim succeeded (first time),
  // false if they've already spent it. `SADD` is atomic in Redis, so
  // two simultaneous sends can't both win the slot. Stored with the
  // same lifetime as the chat log so it's cleaned up with the room.
  async claimLastWords(
    roomCode: string,
    senderId: string
  ): Promise<boolean> {
    const redis = getRedis();
    const key = lastWordsKey(roomCode);
    const added = await redis.sadd(key, senderId);
    await redis.expire(key, CHAT_TTL_SECONDS);
    return added === 1;
  },

  async appendMessage(roomCode: string, message: ChatMessage): Promise<void> {
    const redis = getRedis();
    const key = roomKey(roomCode);
    await redis
      .multi()
      .rpush(key, JSON.stringify(message))
      .ltrim(key, -CHAT_MAX_MESSAGES, -1)
      .expire(key, CHAT_TTL_SECONDS)
      .exec();
  },

  async getRecentMessages(roomCode: string, limit = 100): Promise<ChatMessage[]> {
    const redis = getRedis();
    const safeLimit = Math.max(1, Math.min(limit, CHAT_MAX_MESSAGES));
    const raw = await redis.lrange(roomKey(roomCode), -safeLimit, -1);
    return raw.flatMap((entry) => {
      try {
        return [JSON.parse(entry) as ChatMessage];
      } catch {
        return [];
      }
    });
  },

  async clearRoom(roomCode: string): Promise<void> {
    await getRedis().del(roomKey(roomCode), lastWordsKey(roomCode));
  }
};
