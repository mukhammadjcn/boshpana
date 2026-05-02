import { BunkerCardType, BunkerDifficulty, BunkerPhase, RoomStatus } from "@prisma/client";

export const CARD_TYPES = [
  BunkerCardType.PROFESSION,
  BunkerCardType.HEALTH,
  BunkerCardType.CHARACTER,
  BunkerCardType.SKILL,
  BunkerCardType.BAGGAGE,
  BunkerCardType.FACT
] as const;

export type BunkerPublicState = {
  room: {
    id: string;
    code: string;
    status: RoomStatus;
    round: number;
    winnerTarget: number;
    maxPlayers: number;
  };
  game: {
    phase: BunkerPhase;
    roundNumber: number;
    timerEndsAt: string | null;
    remainingSeconds: number;
    currentTurnPlayerId: string | null;
    lastRevealedPlayerId: string | null;
    lastRevealedCardType: BunkerCardType | null;
    lastEliminatedPlayerId: string | null;
    tiebreakCandidateIds: string[];
    disaster: {
      name: string;
      description: string;
    } | null;
    situation: {
      text: string;
      difficulty: BunkerDifficulty;
    } | null;
  };
  me: {
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    sessionId: string;
    cards: Record<string, string>;
    revealed: BunkerCardType[];
  } | null;
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    online: boolean;
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
