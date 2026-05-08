import { Prisma, RoomMode, RoomVisibility } from "@prisma/client";

import { prisma } from "../lib/prisma";

type ReadyPlayerLike = {
  readyAt: Date | string | null;
};

type MafiaCompositionLike = {
  mafiaCount: number;
  hasSheriff: boolean;
  hasDoctor: boolean;
};

export const BUNKER_ONLINE_MIN_PLAYERS = 3;

// Section 3 of online.md: Bunker winnerTarget grows with the lobby so larger
// public rooms keep the endgame at a meaningful share of survivors.
export function computeBunkerOnlineWinnerTarget(playerCount: number): number {
  if (playerCount <= 5) return 2;
  if (playerCount <= 10) return 3;
  return 4;
}

// Section 3: Mafia composition scales with lobby size.
//   4–6  → 1 mafia + sheriff
//   7–10 → 2 mafia + sheriff + doctor
//   11+  → 3 mafia + sheriff + doctor
export function computeMafiaOnlineComposition(
  playerCount: number
): MafiaCompositionLike {
  if (playerCount <= 6) {
    return { mafiaCount: 1, hasSheriff: true, hasDoctor: false };
  }
  if (playerCount <= 10) {
    return { mafiaCount: 2, hasSheriff: true, hasDoctor: true };
  }
  return { mafiaCount: 3, hasSheriff: true, hasDoctor: true };
}

export function canEnableReady(playerCount: number, minPlayers: number): boolean {
  return playerCount >= minPlayers;
}

export function shouldAutoStartOnlineLobby(
  players: ReadyPlayerLike[],
  minPlayers: number
): boolean {
  return (
    canEnableReady(players.length, minPlayers) &&
    players.length > 0 &&
    players.every((player) => player.readyAt !== null)
  );
}

export function getMafiaOnlineMinPlayers(
  composition: MafiaCompositionLike
): number {
  return (
    composition.mafiaCount +
    (composition.hasSheriff ? 1 : 0) +
    (composition.hasDoctor ? 1 : 0) +
    1
  );
}

// Persists the auto-computed Bunker composition for an online room. Called
// from `startGameUnlocked` for ONLINE mode so PUBLIC matchmake rooms (which
// are created with placeholder defaults) settle on a player-count-aware
// winnerTarget right before the game starts.
export async function applyOnlineBunkerComposition(input: {
  client?: Prisma.TransactionClient;
  roomId: string;
  playerCount: number;
}): Promise<{ winnerTarget: number }> {
  const winnerTarget = computeBunkerOnlineWinnerTarget(input.playerCount);
  const client = input.client ?? prisma;
  await client.room.update({
    where: { id: input.roomId },
    data: { winnerTarget }
  });
  return { winnerTarget };
}

export async function applyOnlineMafiaComposition(input: {
  client?: Prisma.TransactionClient;
  gameId: string;
  playerCount: number;
}): Promise<MafiaCompositionLike> {
  const composition = computeMafiaOnlineComposition(input.playerCount);
  const client = input.client ?? prisma;
  await client.mafiaGame.update({
    where: { id: input.gameId },
    data: composition
  });
  return composition;
}

export async function finalizeOnlineRoomCreation(input: {
  roomCode: string;
  hostPlayerId: string | undefined;
  visibility: RoomVisibility;
  maxPlayers?: number;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.room.update({
      where: { code: input.roomCode },
      data: {
        mode: RoomMode.ONLINE,
        visibility: input.visibility,
        ...(input.maxPlayers ? { maxPlayers: input.maxPlayers } : {})
      }
    });
    if (input.hostPlayerId) {
      await tx.player.update({
        where: { id: input.hostPlayerId },
        data: { readyAt: new Date() }
      });
    }
  });
}
