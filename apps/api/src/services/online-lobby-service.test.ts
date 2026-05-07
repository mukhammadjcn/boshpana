import test from "node:test";
import assert from "node:assert/strict";

import {
  canEnableReady,
  getMafiaOnlineMinPlayers,
  shouldAutoStartOnlineLobby
} from "./online-lobby-service";

test("canEnableReady only unlocks after min player count", () => {
  assert.equal(canEnableReady(2, 3), false);
  assert.equal(canEnableReady(3, 3), true);
  assert.equal(canEnableReady(4, 3), true);
});

test("shouldAutoStartOnlineLobby requires min players and everyone ready", () => {
  const readyAt = new Date("2026-05-06T10:00:00.000Z");

  assert.equal(
    shouldAutoStartOnlineLobby(
      [{ readyAt }, { readyAt }, { readyAt: null }],
      3
    ),
    false
  );

  assert.equal(
    shouldAutoStartOnlineLobby([{ readyAt }, { readyAt }], 3),
    false
  );

  assert.equal(
    shouldAutoStartOnlineLobby([{ readyAt }, { readyAt }, { readyAt }], 3),
    true
  );
});

test("getMafiaOnlineMinPlayers derives the required lobby size from composition", () => {
  assert.equal(
    getMafiaOnlineMinPlayers({
      mafiaCount: 1,
      hasSheriff: true,
      hasDoctor: false
    }),
    3
  );
  assert.equal(
    getMafiaOnlineMinPlayers({
      mafiaCount: 2,
      hasSheriff: true,
      hasDoctor: true
    }),
    5
  );
});
