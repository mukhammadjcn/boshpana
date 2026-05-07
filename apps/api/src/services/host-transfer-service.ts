import { RoomMode, RoomStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";

type HostTransferPlayer = {
  id: string;
  sessionId: string;
  userId: string | null;
  joinedAt: Date;
};

type TransferOnlineRoomHostInput = {
  roomCode: string;
  expectedHostSessionId?: string;
  currentHostPlayerId?: string;
};

export type HostTransferResult =
  | {
      kind: "transferred";
      roomCode: string;
      previousHostSessionId: string;
      nextHostSessionId: string;
      nextHostPlayerId: string;
    }
  | {
      kind: "no_successor";
      roomCode: string;
      previousHostSessionId: string;
    };

const ACTIVE_ROOM_STATUSES: ReadonlySet<RoomStatus> = new Set([
  RoomStatus.LOBBY,
  RoomStatus.PLAYING
]);

export function pickNextHostPlayer<T extends HostTransferPlayer>(
  players: T[],
  currentHostPlayerId: string
): T | null {
  const candidates = players
    .filter((player) => player.id !== currentHostPlayerId)
    .sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime());

  return candidates[0] ?? null;
}

export class HostTransferService {
  async transferOnlineRoomHost(
    input: TransferOnlineRoomHostInput
  ): Promise<HostTransferResult | null> {
    const room = await prisma.room.findUnique({
      where: { code: input.roomCode.toUpperCase() },
      include: {
        players: {
          orderBy: [{ joinedAt: "asc" }, { seatOrder: "asc" }]
        }
      }
    });

    if (!room) {
      return null;
    }
    if (room.mode !== RoomMode.ONLINE) {
      return null;
    }
    if (!ACTIVE_ROOM_STATUSES.has(room.status)) {
      return null;
    }
    if (
      input.expectedHostSessionId &&
      room.hostSessionId !== input.expectedHostSessionId
    ) {
      return null;
    }

    const currentHost =
      (input.currentHostPlayerId
        ? room.players.find((player) => player.id === input.currentHostPlayerId)
        : null) ??
      room.players.find((player) => player.sessionId === room.hostSessionId) ??
      null;

    if (!currentHost) {
      return null;
    }

    const nextHost = pickNextHostPlayer(room.players, currentHost.id);

    if (!nextHost) {
      return {
        kind: "no_successor",
        roomCode: room.code,
        previousHostSessionId: currentHost.sessionId
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.player.updateMany({
        where: { roomId: room.id },
        data: { isHost: false }
      });
      await tx.player.update({
        where: { id: nextHost.id },
        data: { isHost: true }
      });
      await tx.room.update({
        where: { id: room.id },
        data: {
          hostSessionId: nextHost.sessionId,
          hostUserId: nextHost.userId
        }
      });
    });

    return {
      kind: "transferred",
      roomCode: room.code,
      previousHostSessionId: currentHost.sessionId,
      nextHostSessionId: nextHost.sessionId,
      nextHostPlayerId: nextHost.id
    };
  }
}

export const hostTransferService = new HostTransferService();
