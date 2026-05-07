import { GameType, RoomStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { withRoomActionLock } from "./room-action-lock-service";

type JoinLobbyRoomInput = {
  code: string;
  name: string;
  sessionId: string;
  userId?: string;
  expectedGameType: GameType;
  expectedGameLabel: string;
};

export type JoinLobbyRoomResult = {
  roomCode: string;
  playerId: string | undefined;
  didCreatePlayer: boolean;
};

export async function joinLobbyRoom(
  input: JoinLobbyRoomInput
): Promise<JoinLobbyRoomResult> {
  return withRoomActionLock(input.code, () => joinLobbyRoomUnlocked(input));
}

async function joinLobbyRoomUnlocked(
  input: JoinLobbyRoomInput
): Promise<JoinLobbyRoomResult> {
  const room = await prisma.room.findUnique({
    where: { code: input.code.toUpperCase() },
    include: {
      players: {
        orderBy: { seatOrder: "asc" }
      }
    }
  });

  if (!room) {
    throw new Error("Room topilmadi.");
  }
  if (room.gameType !== input.expectedGameType) {
    throw new Error(`Bu ${input.expectedGameLabel} o'yini emas.`);
  }
  if (room.status !== RoomStatus.LOBBY) {
    throw new Error(
      "O'yin boshlanganidan keyin yangi o'yinchi qo'shila olmaydi."
    );
  }

  if (input.userId) {
    const byUser = room.players.find((player) => player.userId === input.userId);
    if (byUser && byUser.sessionId !== input.sessionId) {
      const updated = await prisma.player.update({
        where: { id: byUser.id },
        data: { sessionId: input.sessionId }
      });
      return {
        roomCode: room.code,
        playerId: updated.id,
        didCreatePlayer: false
      };
    }
  }

  const existing = room.players.find(
    (player) => player.sessionId === input.sessionId
  );

  if (existing) {
    if (input.userId && !existing.userId) {
      await prisma.player.update({
        where: { id: existing.id },
        data: { userId: input.userId }
      });
    }
    return {
      roomCode: room.code,
      playerId: existing.id,
      didCreatePlayer: false
    };
  }

  if (room.players.length >= room.maxPlayers) {
    throw new Error("Xona to'lib bo'lgan.");
  }

  const nextSeatOrder =
    Math.max(0, ...room.players.map((player) => player.seatOrder)) + 1;
  const player = await prisma.player.create({
    data: {
      roomId: room.id,
      name: input.name.trim(),
      sessionId: input.sessionId,
      userId: input.userId ?? null,
      seatOrder: nextSeatOrder
    }
  });

  return {
    roomCode: room.code,
    playerId: player.id,
    didCreatePlayer: true
  };
}
