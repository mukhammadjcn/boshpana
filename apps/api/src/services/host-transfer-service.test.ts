import test from "node:test";
import assert from "node:assert/strict";

import { pickNextHostPlayer } from "./host-transfer-service";

test("pickNextHostPlayer chooses the earliest joined successor", () => {
  const players = [
    {
      id: "host",
      sessionId: "session-host",
      userId: "user-host",
      joinedAt: new Date("2026-05-06T10:00:00.000Z")
    },
    {
      id: "p3",
      sessionId: "session-p3",
      userId: "user-p3",
      joinedAt: new Date("2026-05-06T10:02:00.000Z")
    },
    {
      id: "p2",
      sessionId: "session-p2",
      userId: "user-p2",
      joinedAt: new Date("2026-05-06T10:01:00.000Z")
    }
  ];

  assert.deepEqual(pickNextHostPlayer(players, "host"), players[2]);
});

test("pickNextHostPlayer returns null when no successor exists", () => {
  const players = [
    {
      id: "host",
      sessionId: "session-host",
      userId: "user-host",
      joinedAt: new Date("2026-05-06T10:00:00.000Z")
    }
  ];

  assert.equal(pickNextHostPlayer(players, "host"), null);
});
