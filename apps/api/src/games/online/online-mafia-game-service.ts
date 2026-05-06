import { RoomMode, RoomVisibility } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { MafiaGameService } from "../mafia/mafia-game-service";

type OnlineCreateInput = {
  hostName: string;
  sessionId: string;
  hostUserId: string;
  visibility: RoomVisibility;
  // PRIVATE callers (host form) pass their composition. PUBLIC callers
  // (matchmaker) pass placeholder defaults — auto-composition lands in a
  // later phase.
  mafiaCount?: number;
  hasSheriff?: boolean;
  hasDoctor?: boolean;
};

// Composition wrapper around MafiaGameService. Same shape as the Bunker
// online wrapper: delegate to base for room creation, then tag the room as
// ONLINE / PUBLIC|PRIVATE.
export class OnlineMafiaGameService {
  constructor(private readonly base: MafiaGameService) {}

  async createRoom(input: OnlineCreateInput) {
    const result = await this.base.createRoom({
      hostName: input.hostName,
      sessionId: input.sessionId,
      hostUserId: input.hostUserId,
      mafiaCount: input.mafiaCount ?? 1,
      hasSheriff: input.hasSheriff ?? true,
      hasDoctor: input.hasDoctor ?? true,
    });
    await prisma.room.update({
      where: { code: result.roomCode },
      data: {
        mode: RoomMode.ONLINE,
        visibility: input.visibility,
      },
    });
    if (result.playerId) {
      await prisma.player.update({
        where: { id: result.playerId },
        data: { readyAt: new Date() }
      });
    }
    return result;
  }
}
