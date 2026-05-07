import { BunkerCardType, BunkerDifficulty, BunkerPhase, RoomStatus } from "@prisma/client";

import type { LocalizedText } from "../../lib/localized-content";
import type { ChatMessage } from "../../services/chat-service";
import type { OnlineGovernanceState } from "../../services/online-governance-service";

export const CARD_TYPES = [
  BunkerCardType.PROFESSION,
  BunkerCardType.HEALTH,
  BunkerCardType.CHARACTER,
  BunkerCardType.SKILL,
  BunkerCardType.BAGGAGE,
  BunkerCardType.FACT
] as const;

export const BUNKER_INTRO_DURATION_SECONDS = 120;
export const BUNKER_ONLINE_INTRO_DURATION_SECONDS = 15;
export const BUNKER_ONLINE_REVEAL_DURATION_SECONDS = 20;
export const BUNKER_PITCH_DURATION_SECONDS = 120;
export const BUNKER_VOTING_DURATION_SECONDS = 45;
export const BUNKER_ONLINE_ROUND_RESULT_DURATION_SECONDS = 6;

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
      id: string;
      name: LocalizedText;
      description: LocalizedText;
    } | null;
    situation: {
      id: string;
      text: LocalizedText;
      difficulty: BunkerDifficulty;
    } | null;
  };
  me: {
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    sessionId: string;
    cards: Record<string, LocalizedText>;
    revealed: BunkerCardType[];
  } | null;
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    readyAt: string | null;
    online: boolean;
    seatOrder: number;
    visibleCards: Partial<Record<string, LocalizedText>>;
    revealedCards: Partial<Record<string, LocalizedText>>;
    revealedCount: number;
  }>;
  votes: {
    total: number;
    submittedByMe: boolean;
  };
  chat: {
    messages: ChatMessage[];
  };
  governance: OnlineGovernanceState;
};
