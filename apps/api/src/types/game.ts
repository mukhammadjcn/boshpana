import { CardType, Difficulty, GamePhase, RoomStatus } from "@prisma/client";

export const CARD_TYPES = [
  CardType.PROFESSION,
  CardType.HEALTH,
  CardType.CHARACTER,
  CardType.SKILL,
  CardType.BAGGAGE,
  CardType.FACT
] as const;

export type PublicRoomState = {
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
    disaster: {
      name: string;
      description: string;
    } | null;
    situation: {
      text: string;
      difficulty: Difficulty;
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
