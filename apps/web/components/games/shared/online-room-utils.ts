import type {
  GameType,
  RoomMode,
  RoomStatus,
  RoomVisibility,
} from "@/lib/types";

export type ActiveRoomSummary = {
  code: string;
  gameType: GameType;
  status: RoomStatus;
  mode: RoomMode;
  visibility: RoomVisibility;
};

export type ActiveRoomExistsPayload = {
  code: "ACTIVE_ROOM_EXISTS";
  message: string;
  activeRoom: ActiveRoomSummary;
};

type ApiErrorWithPayload<T> = Error & {
  status?: number;
  code?: string;
  payload?: T;
};

type CreateRoomBodyInput = {
  gameType: GameType;
  hostName: string;
  sessionId: string;
  visibility: RoomVisibility;
  confirmLeaveExisting?: boolean;
  options?: Record<string, unknown>;
};

type MatchmakeBodyInput = {
  gameType: GameType;
  hostName: string;
  sessionId: string;
  confirmLeaveExisting?: boolean;
  isAdult?: boolean;
};

export function buildOnlineCreateRoomBody({
  gameType,
  hostName,
  sessionId,
  visibility,
  confirmLeaveExisting = false,
  options = {},
}: CreateRoomBodyInput) {
  return {
    gameType,
    hostName: hostName.trim(),
    sessionId,
    mode: "ONLINE" as const,
    visibility,
    ...(confirmLeaveExisting ? { confirmLeaveExisting: true } : {}),
    ...options,
  };
}

export function buildMatchmakeBody({
  gameType,
  hostName,
  sessionId,
  confirmLeaveExisting = false,
  isAdult,
}: MatchmakeBodyInput) {
  return {
    gameType,
    hostName: hostName.trim(),
    sessionId,
    ...(confirmLeaveExisting ? { confirmLeaveExisting: true } : {}),
    ...(typeof isAdult === "boolean" ? { isAdult } : {}),
  };
}

export function parseActiveRoomConflict(
  error: unknown,
): ActiveRoomExistsPayload | null {
  if (!(error instanceof Error)) return null;
  const typed = error as ApiErrorWithPayload<Partial<ActiveRoomExistsPayload>>;
  if (typed.status !== 409 || typed.code !== "ACTIVE_ROOM_EXISTS") {
    return null;
  }
  const payload = typed.payload;
  if (
    !payload ||
    payload.code !== "ACTIVE_ROOM_EXISTS" ||
    !payload.activeRoom
  ) {
    return null;
  }
  return payload as ActiveRoomExistsPayload;
}
