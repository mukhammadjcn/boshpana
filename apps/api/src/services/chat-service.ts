import crypto from "node:crypto";

import { getRedis } from "../lib/redis";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
};

const CHAT_PREFIX = "chat:";
const CHAT_TTL_SECONDS = 6 * 60 * 60;
const CHAT_MAX_MESSAGES = 500;

function roomKey(roomCode: string): string {
  return `${CHAT_PREFIX}${roomCode.toUpperCase()}`;
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
  }): ChatMessage {
    return {
      id: crypto.randomUUID(),
      senderId: input.senderId,
      senderName: input.senderName,
      text: normalizeText(input.text),
      timestamp: new Date().toISOString()
    };
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
    await getRedis().del(roomKey(roomCode));
  }
};
