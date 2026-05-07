import type { RoomStatus } from "@/lib/types";
import type { OnlineChatMessage } from "../shared/online-chat";
import type { OnlineProposal } from "../bunker/bunker-types";

export type MafiaTeam = "CITY" | "MAFIA";

export type MafiaRole = "CITIZEN" | "MAFIA" | "SHERIFF" | "DOCTOR";

export type MafiaPhase =
  | "ASSIGN_ROLES"
  | "NIGHT"
  | "NIGHT_RESULT"
  | "DAY_DISCUSSION"
  | "DAY_VOTE"
  | "DAY_TIEBREAK"
  | "DAY_RESULT"
  | "FINISHED";

export type MafiaCitizenQuestion = "GUESS_MAFIA_KILL" | "GUESS_DOCTOR_HEAL";

export type MafiaNightActionType =
  | "MAFIA_KILL"
  | "SHERIFF_CHECK"
  | "SHERIFF_SHOOT"
  | "DOCTOR_HEAL"
  | "CITIZEN_GUESS_KILL"
  | "CITIZEN_GUESS_HEAL";

export type MafiaPublicState = {
  room: {
    id: string;
    code: string;
    status: RoomStatus;
    maxPlayers: number;
  };
  game: {
    phase: MafiaPhase;
    nightNumber: number;
    dayNumber: number;
    timerEndsAt: string | null;
    remainingSeconds: number;
    config: {
      mafiaCount: number;
      hasSheriff: boolean;
      hasDoctor: boolean;
    };
    sheriffShotsRemaining: number;
    doctorSelfHealsRemaining: number;
    // ASSIGN_ROLES bosqichida: nechta tirik o'yinchi rolini tasdiqlagan
    // (UI'ga "X / N tasdiqladi" deb chiqarish uchun).
    roleConfirmations: { confirmed: number; total: number };
    winner: MafiaTeam | null;
    lastNightVictims: Array<{ playerId: string; role: MafiaRole }>;
    lastNightDoctorSaved: boolean;
    lastEliminatedPlayerId: string | null;
    lastEliminatedRole: MafiaRole | null;
    tiebreakCandidateIds: string[];
  };
  me: {
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    sessionId: string;
    role: MafiaRole | null;
    mafiaTeammates: string[];
    sheriffChecks: Array<{
      playerId: string;
      isMafia: boolean;
      nightNumber: number;
    }>;
    citizenQuestion: MafiaCitizenQuestion | null;
    pendingNightTargetId: string | null;
    // Sherif uchun: tekshirish yoki o'q uzish modidan qaysi biri tanlangan.
    // Boshqa rollar (MAFIA_KILL, DOCTOR_HEAL, CITIZEN_GUESS_*) uchun ham
    // joriy raunddagi tanlovni ifodalaydi.
    pendingNightAction: MafiaNightActionType | null;
    // True once the user has tapped "Tasdiqlash" on the role-reveal
    // modal — frontend uses this to render the "host'ni kuting" wait
    // state until everyone confirms and the night begins.
    roleConfirmed: boolean;
  } | null;
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    readyAt: string | null;
    online: boolean;
    seatOrder: number;
    revealedRole: MafiaRole | null;
  }>;
  mafiaPicks: Array<{
    actorPlayerId: string;
    targetPlayerId: string | null;
  }>;
  night: {
    submittedByMe: boolean;
    confirmedByMe: boolean;
    confirmations: {
      confirmed: number;
      total: number;
    };
  };
  votes: {
    total: number;
    submittedByMe: boolean;
    myTargetPlayerId: string | null;
    confirmedByMe: boolean;
    confirmations: {
      confirmed: number;
      total: number;
    };
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
