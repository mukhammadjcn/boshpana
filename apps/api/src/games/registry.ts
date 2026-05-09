import { GameType } from "@prisma/client";

import { BunkerGameService } from "./bunker/bunker-game-service";
import { MafiaGameService } from "./mafia/mafia-game-service";
import { OnlineBunkerGameService } from "./online/online-bunker-game-service";
import { OnlineMafiaGameService } from "./online/online-mafia-game-service";

type RealtimePublisher = Parameters<BunkerGameService["setRealtime"]>[0];

export class GameRegistry {
  readonly bunker = new BunkerGameService();
  readonly mafia = new MafiaGameService();
  readonly onlineBunker = new OnlineBunkerGameService(this.bunker);
  readonly onlineMafia = new OnlineMafiaGameService(this.mafia);

  setRealtime(publisher: RealtimePublisher) {
    this.bunker.setRealtime(publisher);
    this.mafia.setRealtime(publisher);
  }

  startCleanupSweeper(
    ...args: Parameters<BunkerGameService["startCleanupSweeper"]>
  ) {
    // Cleanup sweeper Room status/age bo'yicha ishlaydi — gameType'dan
    // mustaqil. Bunker tomonida bitta sweeper hamma o'yinlarning eski
    // xonalarini tozalaydi, shuning uchun mafia uchun alohida
    // sweeper kerak emas.
    this.bunker.startCleanupSweeper(...args);
  }

  async shutdown() {
    await Promise.all([this.bunker.shutdown(), this.mafia.shutdown()]);
  }

  // Restart in-flight timers after a deploy / crash. Without this, the
  // server boots with empty `timers` Maps and any room mid-round has
  // its phase frozen forever (timerEndsAt in the past, no interval).
  async resumeTimers() {
    await Promise.all([this.bunker.resumeTimers(), this.mafia.resumeTimers()]);
  }

  // Returns the per-game service that owns the action surface for the
  // given game type. Realtime hub and routes use this to dispatch
  // game-specific calls (reveal_card, vote, etc.) to the right module.
  for(gameType: GameType) {
    switch (gameType) {
      case GameType.BUNKER:
        return this.bunker;
      case GameType.MAFIA:
        return this.mafia;
    }
  }

  // Online creation dispatch. Online services share the action surface of
  // their base counterpart (use `for()` for in-game events) — this method
  // only exists for the createRoom path, where ONLINE rooms need their
  // mode/visibility tagged at creation time.
  forOnline(gameType: GameType) {
    switch (gameType) {
      case GameType.BUNKER:
        return this.onlineBunker;
      case GameType.MAFIA:
        return this.onlineMafia;
    }
  }
}
