"use client";

import { create } from "zustand";

import type { RoomState } from "@/lib/types";

type GameStore = {
  roomState: RoomState | null;
  error: string | null;
  setRoomState: (roomState: RoomState | null) => void;
  patchTimer: (remainingSeconds: number) => void;
  setError: (error: string | null) => void;
};

export const useGameStore = create<GameStore>((set) => ({
  roomState: null,
  error: null,
  setRoomState: (roomState) => set({ roomState, error: null }),
  patchTimer: (remainingSeconds) =>
    set((state) =>
      state.roomState
        ? {
            roomState: {
              ...state.roomState,
              game: {
                ...state.roomState.game,
                remainingSeconds
              }
            }
          }
        : state
    ),
  setError: (error) => set({ error })
}));
