import { prisma } from "../lib/prisma";

const LOCK_MAX_WAIT_MS = 15_000;
const LOCK_TIMEOUT_MS = 30_000;

async function withAdvisoryLock<T>(
  lockKey: string,
  action: () => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      `;
      return action();
    },
    {
      maxWait: LOCK_MAX_WAIT_MS,
      timeout: LOCK_TIMEOUT_MS
    }
  );
}

export async function withRoomActionLock<T>(
  roomCode: string,
  action: () => Promise<T>
): Promise<T> {
  return withAdvisoryLock(`room:${roomCode.toUpperCase()}`, action);
}

export async function withMatchmakingPoolLock<T>(
  poolKey: string,
  action: () => Promise<T>
): Promise<T> {
  return withAdvisoryLock(`matchmake:${poolKey}`, action);
}
