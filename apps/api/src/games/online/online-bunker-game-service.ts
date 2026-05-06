import { RoomMode, RoomVisibility } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { BunkerGameService } from "../bunker/bunker-game-service";

type OnlineCreateInput = {
  hostName: string;
  sessionId: string;
  hostUserId: string;
  visibility: RoomVisibility;
  // Optional creator-chosen settings (PRIVATE). For PUBLIC the matchmaker
  // passes placeholder defaults — auto-composition lands in a later phase.
  winnerTarget?: number;
  isAdult?: boolean;
};

// Composition wrapper around BunkerGameService. The base service is left
// untouched; this service delegates to it and then tags the room as
// ONLINE / PUBLIC|PRIVATE in a follow-up update so the dispatch layer can
// route subsequent events to the online flow without forking the base.
export class OnlineBunkerGameService {
  constructor(private readonly base: BunkerGameService) {}

  async createRoom(input: OnlineCreateInput) {
    // Base service caps maxPlayers at 10 (Friends default). Online lobbies
    // need to grow up to 16, so we let the base create with its default and
    // then widen maxPlayers in the same follow-up that flips mode/visibility.
    const result = await this.base.createRoom({
      hostName: input.hostName,
      sessionId: input.sessionId,
      hostUserId: input.hostUserId,
      winnerTarget: input.winnerTarget ?? 2,
      isAdult: input.isAdult,
    });
    await prisma.room.update({
      where: { code: result.roomCode },
      data: {
        mode: RoomMode.ONLINE,
        visibility: input.visibility,
        maxPlayers: 16,
      },
    });
    return result;
  }
}
