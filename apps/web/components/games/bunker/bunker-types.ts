import type { RoomStatus } from "@/lib/types";
import type { LocalizedText } from "@/lib/localized-content";
import type { OnlineChatMessage } from "../shared/online-chat";

export type OnlineProposal = {
  id: string;
  kind: "END_GAME" | "KICK" | "SKIP_TO_VOTE";
  proposerPlayerId: string;
  proposerName: string;
  targetPlayerId: string | null;
  targetName: string | null;
  eligiblePlayerIds: string[];
  approvals: string[];
  rejections: string[];
  createdAt: string;
  majority: number;
};

export type BunkerPhase =
  | "LOBBY"
  | "INTRO"
  | "ROUND_REVEAL"
  | "ROUND_PITCH"
  | "ROUND_COMPLETE"
  | "VOTING"
  | "FINISHED";

export type BunkerCardType =
  | "PROFESSION"
  | "HEALTH"
  | "CHARACTER"
  | "SKILL"
  | "BAGGAGE"
  | "FACT";

export type BunkerRoomState = {
  room: {
    id: string;
    code: string;
    status: RoomStatus;
    round: number;
    winnerTarget: number;
    maxPlayers: number;
    isAdult: boolean;
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
      difficulty: string;
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
    messages: OnlineChatMessage[];
  };
  governance: {
    endGameProposal: OnlineProposal | null;
    kickProposal: OnlineProposal | null;
    skipToVoteProposal: OnlineProposal | null;
  };
};
