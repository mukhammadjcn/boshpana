import { BunkerCardType, BunkerDifficulty, BunkerPhase, RoomStatus } from "@prisma/client";

import type { LocalizedText } from "../../lib/localized-content";
import type { ChatMessage } from "../../services/chat-service";
import type { OnlineGovernanceState } from "../../services/online-governance-service";

export const CARD_TYPES = [
  BunkerCardType.PROFESSION,
  BunkerCardType.HEALTH,
  BunkerCardType.BIOLOGY,
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

// O'yinchi o'zining qo'lidagi maxsus karta nusxasi.
// Faza 2 da read-only — Ishlatish tugmasi qisqa muddatda passiv qoladi.
export type BunkerActionCardView = {
  instanceId: string;
  cardKey: string;
  title: LocalizedText;
  description: LocalizedText;
  effect: string; // BunkerActionEffect enum sifatida — frontend tip qatlamida cheklaymiz
  targetScope: "SELF" | "OTHER" | "ANY" | "ALL";
  tier: number;
  status: "HELD" | "PLAYED" | "DISCARDED";
};

export type BunkerPublicState = {
  room: {
    id: string;
    code: string;
    status: RoomStatus;
    round: number;
    winnerTarget: number;
    maxPlayers: number;
    isAdult: boolean;
    actionCardsEnabled: boolean;
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
      tier: number | null;
      highlightTags: string[];
      weakTags: string[];
      voteReason: LocalizedText | null;
    } | null;
  };
  me: {
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    sessionId: string;
    cards: Record<string, LocalizedText>;
    cardTags: Record<string, string[]>;
    revealed: BunkerCardType[];
    // Faqat o'yinchining o'z action kartalari. Boshqalarning kartalari yashirin
    // qoladi — bu Faza 2 da read-only, ishlatish keyingi fazalarda.
    actionCards: BunkerActionCardView[];
    // EXTRA_BAGGAGE effekti orqali qo'lga kiritilgan qo'shimcha bagaj matnlari.
    // Asosiy `cards.BAGGAGE`'ga qo'shimcha sifatida UI ko'rsatadi; refresh
    // qilinsa ham yo'qolmaydi (action instance resultMeta dan o'qiladi).
    extraBaggage: string[];
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
    revealedCardTags: Partial<Record<string, string[]>>;
    revealedCount: number;
    // Server-computed badge for THIS round's situation: counts the
    // player's revealed-card tags against the situation's highlight/weak
    // tags. Pure UI hint — voting stays free-form.
    situationBadge: "green" | "red" | "neutral";
    // Bu raundga oid maxsus karta modifierlari (ko'rinarli holat uchun).
    // Raund yakunida tozalanadi.
    actionModifiers: {
      immune: boolean;
      doubleVote: boolean;
      silenced: boolean;
      skipRound: boolean;
    };
  }>;
  votes: {
    total: number;
    submittedByMe: boolean;
    // How many players this round will eliminate. Online rooms read this
    // from the back-loaded schedule; friends rooms always show 1. UI uses it
    // to gate multi-select voting and to render the "X kishi chiqariladi"
    // info banner before the vote.
    elimsThisRound: number;
  };
  chat: {
    messages: ChatMessage[];
  };
  governance: OnlineGovernanceState;
};
