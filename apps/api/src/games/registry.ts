import { GameType } from "@prisma/client";

import { BunkerGameService } from "./bunker/bunker-game-service";

type RealtimePublisher = Parameters<BunkerGameService["setRealtime"]>[0];

export class GameRegistry {
  readonly bunker = new BunkerGameService();
  // Future entries (one per game module):
  //   readonly mafia = new MafiaGameService();

  setRealtime(publisher: RealtimePublisher) {
    this.bunker.setRealtime(publisher);
  }

  startCleanupSweeper(
    ...args: Parameters<BunkerGameService["startCleanupSweeper"]>
  ) {
    this.bunker.startCleanupSweeper(...args);
  }

  async shutdown() {
    await this.bunker.shutdown();
  }

  // Returns the per-game service that owns the action surface for the
  // given game type. Realtime hub and routes use this to dispatch
  // game-specific calls (reveal_card, vote, etc.) to the right module.
  for(gameType: GameType) {
    switch (gameType) {
      case GameType.BUNKER:
        return this.bunker;
      case GameType.MAFIA:
        throw new Error("Mafia game module is not registered yet.");
    }
  }
}
