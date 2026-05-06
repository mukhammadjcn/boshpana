import { RoomMode } from "@prisma/client";

import {
  BUNKER_INTRO_DURATION_SECONDS,
  BUNKER_ONLINE_INTRO_DURATION_SECONDS,
  BUNKER_ONLINE_REVEAL_DURATION_SECONDS,
  BUNKER_ONLINE_ROUND_RESULT_DURATION_SECONDS
} from "../bunker/bunker-types";
import {
  MAFIA_DAY_RESULT_DURATION_SECONDS,
  MAFIA_NIGHT_RESULT_DURATION_SECONDS
} from "../mafia/mafia-types";

export function isSelfManagedOnlineRoom(mode: RoomMode): boolean {
  return mode === RoomMode.ONLINE;
}

export function getBunkerIntroDurationSeconds(mode: RoomMode): number {
  return isSelfManagedOnlineRoom(mode)
    ? BUNKER_ONLINE_INTRO_DURATION_SECONDS
    : BUNKER_INTRO_DURATION_SECONDS;
}

export function getBunkerRoundResultDurationSeconds(mode: RoomMode): number | null {
  return isSelfManagedOnlineRoom(mode)
    ? BUNKER_ONLINE_ROUND_RESULT_DURATION_SECONDS
    : null;
}

export function getBunkerRevealDurationSeconds(mode: RoomMode): number | null {
  return isSelfManagedOnlineRoom(mode)
    ? BUNKER_ONLINE_REVEAL_DURATION_SECONDS
    : null;
}

export function getMafiaResultRevealDurationSeconds(
  mode: RoomMode,
  phase: "NIGHT_RESULT" | "DAY_RESULT"
): number | null {
  if (!isSelfManagedOnlineRoom(mode)) {
    return null;
  }
  return phase === "NIGHT_RESULT"
    ? MAFIA_NIGHT_RESULT_DURATION_SECONDS
    : MAFIA_DAY_RESULT_DURATION_SECONDS;
}
