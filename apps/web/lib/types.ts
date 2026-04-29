export type GamePhase = "LOBBY" | "DISCUSSION" | "REVEAL" | "VOTING" | "FINISHED";
export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED";
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
    revealedCards: Partial<Record<string, string>>;
    revealedCount: number;
  }>;
  votes: {
    total: number;
    submittedByMe: boolean;
  };
};
