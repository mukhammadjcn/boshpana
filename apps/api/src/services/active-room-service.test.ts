import assert from "node:assert/strict";
import test from "node:test";

import {
  GameType,
  MafiaPhase,
  MafiaRole,
  RoomMode,
  RoomStatus,
  RoomVisibility
} from "@prisma/client";

import { isBlockingActiveRoom } from "./active-room-service";

const baseRoom = {
  code: "ABC123",
  gameType: GameType.MAFIA,
  status: RoomStatus.PLAYING,
  mode: RoomMode.ONLINE,
  visibility: RoomVisibility.PRIVATE
} as const;

test("finished mafia winner screens are not treated as blocking active rooms", () => {
  assert.equal(
    isBlockingActiveRoom({
      ...baseRoom,
      mafiaGame: {
        phase: MafiaPhase.DAY_RESULT,
        winner: "CITY"
      },
      players: [
        { mafiaRole: { role: MafiaRole.CITIZEN, isAlive: true } },
        { mafiaRole: { role: MafiaRole.MAFIA, isAlive: false } }
      ]
    }),
    false
  );
});

test("unfinished lobbies still block new online games", () => {
  assert.equal(
    isBlockingActiveRoom({
      ...baseRoom,
      status: RoomStatus.LOBBY,
      mafiaGame: {
        phase: MafiaPhase.ASSIGN_ROLES,
        winner: null
      },
      players: []
    }),
    true
  );
});
