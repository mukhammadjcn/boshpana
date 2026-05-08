import test from "node:test";
import assert from "node:assert/strict";

import {
  canEnableReady,
  computeBunkerOnlineWinnerTarget,
  computeMafiaOnlineComposition,
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

test("computeBunkerOnlineWinnerTarget scales by lobby size", () => {
  // 3-5 players → 2 winners
  assert.equal(computeBunkerOnlineWinnerTarget(3), 2);
  assert.equal(computeBunkerOnlineWinnerTarget(5), 2);
  // 6-10 → 3
  assert.equal(computeBunkerOnlineWinnerTarget(6), 3);
  assert.equal(computeBunkerOnlineWinnerTarget(10), 3);
  // 11-16 → 4
  assert.equal(computeBunkerOnlineWinnerTarget(11), 4);
  assert.equal(computeBunkerOnlineWinnerTarget(16), 4);
});

test("computeMafiaOnlineComposition scales roles by lobby size", () => {
  assert.deepEqual(computeMafiaOnlineComposition(4), {
    mafiaCount: 1,
    hasSheriff: true,
    hasDoctor: false
  });
  assert.deepEqual(computeMafiaOnlineComposition(6), {
    mafiaCount: 1,
    hasSheriff: true,
    hasDoctor: false
  });
  assert.deepEqual(computeMafiaOnlineComposition(7), {
    mafiaCount: 2,
    hasSheriff: true,
    hasDoctor: true
  });
  assert.deepEqual(computeMafiaOnlineComposition(10), {
    mafiaCount: 2,
    hasSheriff: true,
    hasDoctor: true
  });
  assert.deepEqual(computeMafiaOnlineComposition(11), {
    mafiaCount: 3,
    hasSheriff: true,
    hasDoctor: true
  });
  assert.deepEqual(computeMafiaOnlineComposition(15), {
    mafiaCount: 3,
    hasSheriff: true,
    hasDoctor: true
  });
});
