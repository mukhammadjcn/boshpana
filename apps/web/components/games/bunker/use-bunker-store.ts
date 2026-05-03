"use client";

import { create } from "zustand";

import type { BunkerRoomState } from "./bunker-types";

type GameStore = {
  roomState: BunkerRoomState | null;
  error: string | null;
  setRoomState: (roomState: BunkerRoomState | null) => void;
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
