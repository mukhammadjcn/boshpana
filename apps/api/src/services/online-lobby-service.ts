import { RoomMode, RoomVisibility } from "@prisma/client";

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
