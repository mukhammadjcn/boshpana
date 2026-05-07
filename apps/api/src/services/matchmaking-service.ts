import { GameType, RoomMode, RoomStatus, RoomVisibility } from "@prisma/client";

import { GameRegistry } from "../games/registry";
import { prisma } from "../lib/prisma";
import { withMatchmakingPoolLock } from "./room-action-lock-service";

type MatchmakeInput = {
  gameType: GameType;
  hostName: string;
  sessionId: string;
  hostUserId: string;
  // Bunker only: matchmake adult-aware. Mafia ignores this.
  isAdult?: boolean;
};

type MatchmakeResult = {
  roomCode: string;
  playerId: string | undefined;
  isNew: boolean;
};

// Find-or-create for online public lobbies. The user taps "Public join"
// and we either drop them into the oldest open lobby that matches their
// pool (gameType + isAdult for Bunker), or spin up a new one and make
// them the creator.
//
// Bunker pools are split strict: a Normal user only ever lands in a
// Normal lobby and vice versa. Mafia has no adult split.
export class MatchmakingService {
  constructor(private readonly registry: GameRegistry) {}

  async findOrCreatePublicRoom(input: MatchmakeInput): Promise<MatchmakeResult> {
    return withMatchmakingPoolLock(buildMatchmakingPoolKey(input), () =>
      this.findOrCreatePublicRoomUnlocked(input)
    );
  }

  private async findOrCreatePublicRoomUnlocked(
    input: MatchmakeInput
  ): Promise<MatchmakeResult> {
    const isAdultFilter =
      input.gameType === GameType.BUNKER ? !!input.isAdult : undefined;

    // Step 1: oldest matching open lobby with capacity. Filter on the same
    // index we added in schema (mode, visibility, status, gameType).
    const candidates = await prisma.room.findMany({
      where: {
        mode: RoomMode.ONLINE,
        visibility: RoomVisibility.PUBLIC,
        status: RoomStatus.LOBBY,
        gameType: input.gameType,
        ...(isAdultFilter !== undefined ? { isAdult: isAdultFilter } : {}),
      },
      select: {
        code: true,
        maxPlayers: true,
        _count: { select: { players: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const service = this.registry.for(input.gameType);
    const openRooms = candidates.filter((r) => r._count.players < r.maxPlayers);
    for (const open of openRooms) {
      try {
        const result = await service.joinRoom({
          code: open.code,
          name: input.hostName,
          sessionId: input.sessionId,
          userId: input.hostUserId,
        });
        return {
          roomCode: result.roomCode,
          playerId: result.playerId,
          isNew: false,
        };
      } catch (error) {
        if (isUnavailableLobbyError(error)) {
          continue;
        }
        throw error;
      }
    }

    // Step 2: no matching lobby — create a new PUBLIC room and become its
    // creator. Composition for PUBLIC lobbies is auto-computed at start
    // time, so we pass the wrapper's defaults here.
    const result =
      input.gameType === GameType.BUNKER
        ? await this.registry.onlineBunker.createRoom({
            hostName: input.hostName,
            sessionId: input.sessionId,
            hostUserId: input.hostUserId,
            visibility: RoomVisibility.PUBLIC,
            isAdult: isAdultFilter,
          })
        : await this.registry.onlineMafia.createRoom({
            hostName: input.hostName,
            sessionId: input.sessionId,
            hostUserId: input.hostUserId,
            visibility: RoomVisibility.PUBLIC,
          });

    return {
      roomCode: result.roomCode,
      playerId: result.playerId,
      isNew: true,
    };
  }
}

export function buildMatchmakingPoolKey(input: {
  gameType: GameType;
  isAdult?: boolean;
}): string {
  const pool =
    input.gameType === GameType.BUNKER
      ? input.isAdult
        ? "adult"
        : "normal"
      : "all";
  return [input.gameType, pool].join(":");
}

function isUnavailableLobbyError(error: unknown): boolean {
  const message = (error as Error).message ?? "";
  return (
    message.includes("to'lib") ||
    message.includes("O'yin boshlanganidan keyin")
  );
}
