import Redis from "ioredis";

import { env } from "./env";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  client = new Redis(env.redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true
  });
  client.on("error", (err) => {
    console.error("[redis] error", err.message);
  });
  client.on("connect", () => {
    console.log(`[redis] connected to ${env.redisUrl}`);
  });
  return client;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch (error) {
    console.error("[redis] quit failed", error);
  }
  client = null;
}
