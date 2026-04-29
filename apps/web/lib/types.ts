export type GamePhase =
  | "LOBBY"
  | "INTRO"
  | "ROUND_REVEAL"
  | "ROUND_PITCH"
  | "ROUND_COMPLETE"
  | "VOTING"
  | "FINISHED";
export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED" | "CANCELLED";
export type CardType =
  | "PROFESSION"
  | "HEALTH"
  | "CHARACTER"
  | "SKILL"
  | "BAGGAGE"
  | "FACT";

export type RoomState = {
  room: {
    id: string;
    code: string;
    status: RoomStatus;
    round: number;
    winnerTarget: number;
    maxPlayers: number;
  };
  game: {
    phase: GamePhase;
    roundNumber: number;
    timerEndsAt: string | null;
    remainingSeconds: number;
    currentTurnPlayerId: string | null;
    lastRevealedPlayerId: string | null;
    lastRevealedCardType: CardType | null;
    lastEliminatedPlayerId: string | null;
    tiebreakCandidateIds: string[];
    disaster: {
      name: string;
      description: string;
    } | null;
    situation: {
      text: string;
      difficulty: string;
    } | null;
  };
  me: {
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    sessionId: string;
    cards: Record<string, string>;
    revealed: CardType[];
  } | null;
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    seatOrder: number;
    visibleCards: Partial<Record<string, string>>;
    revealedCards: Partial<Record<string, string>>;
    revealedCount: number;
  }>;
  votes: {
    total: number;
    submittedByMe: boolean;
  };
};
