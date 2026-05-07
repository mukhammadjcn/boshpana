import test from "node:test";
import assert from "node:assert/strict";

import { RoomStatus } from "@prisma/client";

import { getEligibleOnlineProposalPlayerIds } from "./online-governance-action-service";

const players = [
  { id: "p1", isAlive: true },
  { id: "p2", isAlive: false },
  { id: "p3", isAlive: true }
];

test("getEligibleOnlineProposalPlayerIds includes everyone in lobby", () => {
  assert.deepEqual(
    getEligibleOnlineProposalPlayerIds(RoomStatus.LOBBY, players),
    ["p1", "p2", "p3"]
  );
});

test("getEligibleOnlineProposalPlayerIds includes only alive players in game", () => {
  assert.deepEqual(
    getEligibleOnlineProposalPlayerIds(RoomStatus.PLAYING, players),
    ["p1", "p3"]
  );
});
