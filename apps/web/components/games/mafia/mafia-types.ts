import type { RoomStatus } from "@/lib/types";

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
  } | null;
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    online: boolean;
    seatOrder: number;
    revealedRole: MafiaRole | null;
  }>;
  mafiaPicks: Array<{
    actorPlayerId: string;
    targetPlayerId: string | null;
  }>;
  votes: {
    total: number;
    submittedByMe: boolean;
  };
};
