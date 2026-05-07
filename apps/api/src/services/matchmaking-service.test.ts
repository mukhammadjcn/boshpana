import test from "node:test";
import assert from "node:assert/strict";

import { GameType } from "@prisma/client";

import { buildMatchmakingPoolKey } from "./matchmaking-service";

test("buildMatchmakingPoolKey keeps Bunker adult and normal pools separate", () => {
  assert.equal(
    buildMatchmakingPoolKey({ gameType: GameType.BUNKER, isAdult: false }),
    "BUNKER:normal"
  );
  assert.equal(
    buildMatchmakingPoolKey({ gameType: GameType.BUNKER, isAdult: true }),
    "BUNKER:adult"
  );
});

test("buildMatchmakingPoolKey uses one public pool for Mafia", () => {
  assert.equal(
    buildMatchmakingPoolKey({ gameType: GameType.MAFIA, isAdult: true }),
    "MAFIA:all"
  );
  assert.equal(
    buildMatchmakingPoolKey({ gameType: GameType.MAFIA }),
    "MAFIA:all"
  );
});
