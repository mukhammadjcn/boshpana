import {
  GameType,
  MafiaPhase,
  MafiaRole,
  RoomMode,
  RoomStatus,
  RoomVisibility
} from "@prisma/client";

import { prisma } from "../lib/prisma";

export type ActiveRoomSummary = {
  code: string;
  gameType: GameType;
  status: RoomStatus;
  mode: RoomMode;
  visibility: RoomVisibility;
};

type ActiveRoomCandidate = ActiveRoomSummary & {
  mafiaGame?: {
    phase: MafiaPhase;
    winner: string | null;
  } | null;
  players?: Array<{
    mafiaRole?: {
      role: MafiaRole;
      isAlive: boolean;
    } | null;
  }>;
};

export function isBlockingActiveRoom(
  room: ActiveRoomCandidate | null | undefined
): room is ActiveRoomCandidate {
  if (!room) {
    return false;
  }
  if (room.gameType !== GameType.MAFIA || !room.mafiaGame) {
    return true;
  }
  if (
    room.status === RoomStatus.FINISHED ||
    room.status === RoomStatus.CANCELLED ||
    room.mafiaGame.phase === MafiaPhase.FINISHED ||
    room.mafiaGame.winner
  ) {
    return false;
  }
  if (room.mafiaGame.phase !== MafiaPhase.DAY_RESULT || !room.players?.length) {
    return true;
  }

  let mafiaAlive = 0;
  let cityAlive = 0;
  for (const player of room.players) {
    if (!player.mafiaRole?.isAlive) continue;
    if (player.mafiaRole.role === MafiaRole.MAFIA) mafiaAlive += 1;
    else cityAlive += 1;
  }

  return !(mafiaAlive === 0 || mafiaAlive >= cityAlive);
}

// Returns the user's currently active room (LOBBY or PLAYING), if any.
// Used to enforce the "1 user = 1 active room" rule across create and
// matchmake — the API responds 409 with this summary so the client can
// show the "Continue or start new?" modal.
export async function findActiveRoomForUser(
  userId: string,
): Promise<ActiveRoomSummary | null> {
  const player = await prisma.player.findFirst({
    where: {
      userId,
      room: {
        status: { in: [RoomStatus.LOBBY, RoomStatus.PLAYING] },
      },
    },
    select: {
      room: {
        select: {
          code: true,
          gameType: true,
          status: true,
          mode: true,
          visibility: true,
          mafiaGame: {
            select: {
              phase: true,
              winner: true
            }
          },
          players: {
            select: {
              mafiaRole: {
                select: {
                  role: true,
                  isAlive: true
                }
              }
            }
          }
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  return isBlockingActiveRoom(player?.room) ? player.room : null;
}
