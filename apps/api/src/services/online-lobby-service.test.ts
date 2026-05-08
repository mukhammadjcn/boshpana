import test from "node:test";
import assert from "node:assert/strict";

import {
  canEnableReady,
  computeBunkerEliminationSchedule,
  computeBunkerOnlineWinnerTarget,
  computeMafiaOnlineComposition,
  getBunkerEliminationsForRound,
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

test("computeBunkerEliminationSchedule sparse case skips early rounds when total < 6", () => {
  // 6 players, W=2 → 4 elims, last 4 rounds carry 1 each
  assert.deepEqual(computeBunkerEliminationSchedule(6, 2), [0, 0, 1, 1, 1, 1]);
  // 4 players, W=2 → 2 elims, only the last 2 rounds carry 1
  assert.deepEqual(computeBunkerEliminationSchedule(4, 2), [0, 0, 0, 0, 1, 1]);
  // 8 players, W=3 → 5 elims (just under threshold), R1 skips voting
  assert.deepEqual(computeBunkerEliminationSchedule(8, 3), [0, 1, 1, 1, 1, 1]);
});

test("computeBunkerEliminationSchedule dense case keeps min 1 per round and back-loads extras", () => {
  // 9 players, W=3 → exactly 6 elims, uniform 1 per round
  assert.deepEqual(computeBunkerEliminationSchedule(9, 3), [1, 1, 1, 1, 1, 1]);
  // 12 players, W=4 → 8 elims, last two rounds carry the extra
  assert.deepEqual(computeBunkerEliminationSchedule(12, 4), [1, 1, 1, 1, 2, 2]);
  // 16 players, W=4 → 12 elims, staircase progression
  assert.deepEqual(computeBunkerEliminationSchedule(16, 4), [1, 1, 2, 2, 3, 3]);
});

test("computeBunkerEliminationSchedule sums to playerCount - winnerTarget", () => {
  for (let n = 3; n <= 16; n += 1) {
    const w = n <= 5 ? 2 : n <= 10 ? 3 : 4;
    const schedule = computeBunkerEliminationSchedule(n, w);
    assert.equal(schedule.length, 6);
    assert.equal(
      schedule.reduce((a, b) => a + b, 0),
      n - w,
      `n=${n} w=${w} did not sum to ${n - w}`
    );
  }
});

test("getBunkerEliminationsForRound reads the schedule for a 1-indexed round", () => {
  // 16 → 4 schedule is [1,1,2,2,3,3]
  assert.equal(getBunkerEliminationsForRound(16, 4, 1), 1);
  assert.equal(getBunkerEliminationsForRound(16, 4, 5), 3);
  assert.equal(getBunkerEliminationsForRound(16, 4, 6), 3);
  // out-of-range rounds return 0 (defensive)
  assert.equal(getBunkerEliminationsForRound(16, 4, 0), 0);
  assert.equal(getBunkerEliminationsForRound(16, 4, 7), 0);
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
