import assert from "node:assert/strict";
import test from "node:test";

import { RoomMode } from "@prisma/client";

import {
  getBunkerIntroDurationSeconds,
  getBunkerRevealDurationSeconds,
  getBunkerRoundResultDurationSeconds,
  getMafiaResultRevealDurationSeconds,
  isSelfManagedOnlineRoom
} from "./online-self-managed-rules";

test("online mode is treated as self-managed", () => {
  assert.equal(isSelfManagedOnlineRoom(RoomMode.ONLINE), true);
  assert.equal(isSelfManagedOnlineRoom(RoomMode.FRIENDS), false);
});

test("bunker durations switch for self-managed online rooms", () => {
  assert.equal(getBunkerIntroDurationSeconds(RoomMode.ONLINE), 15);
  assert.equal(getBunkerRevealDurationSeconds(RoomMode.ONLINE), 20);
  assert.equal(getBunkerRoundResultDurationSeconds(RoomMode.ONLINE), 6);
  assert.equal(getBunkerRoundResultDurationSeconds(RoomMode.FRIENDS), null);
});

test("mafia reveal delays only exist for online mode", () => {
  assert.equal(
    getMafiaResultRevealDurationSeconds(RoomMode.ONLINE, "NIGHT_RESULT"),
    8
  );
  assert.equal(
    getMafiaResultRevealDurationSeconds(RoomMode.ONLINE, "DAY_RESULT"),
    6
  );
  assert.equal(
    getMafiaResultRevealDurationSeconds(RoomMode.FRIENDS, "DAY_RESULT"),
    null
  );
});
