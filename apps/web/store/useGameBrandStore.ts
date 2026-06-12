"use client";

import { create } from "zustand";

import type { GameType } from "@/lib/types";

// Holds the active game (BUNKER / MAFIA) while a game experience is mounted,
// so the top safe-area brand strip can show "bunker" / "mafia" inside a game
// and fall back to "jamoaviy.uz" everywhere else. GameRouter is the single
// writer: it sets the type once room info resolves and clears it on unmount.
type GameBrandStore = {
  activeGame: GameType | null;
  setActiveGame: (game: GameType | null) => void;
};

export const useGameBrandStore = create<GameBrandStore>((set) => ({
  activeGame: null,
  setActiveGame: (activeGame) => set({ activeGame }),
}));
