"use client";

import { create } from "zustand";

export type ToastKind = "info" | "success" | "warn" | "error";

export type Toast = {
  id: string;
  kind: ToastKind;
  text: string;
};

type ToastInput = Omit<Toast, "id"> & { id?: string; durationMs?: number };

type ToastStore = {
  toasts: Toast[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: ({ id, kind, text, durationMs = 3500 }) => {
    const toastId =
      id ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => {
      // Coalesce if a toast with the same id (or same text within 1s) is
      // already shown — prevents the same network error from spamming the
      // viewport when a flaky socket retries.
      const existing = s.toasts.find((t) => t.id === toastId);
      if (existing) return s;
      const recentDup = s.toasts.find(
        (t) => t.text === text && t.kind === kind
      );
      if (recentDup) return s;
      return { toasts: [...s.toasts, { id: toastId, kind, text }] };
    });
    if (durationMs > 0) {
      window.setTimeout(() => get().dismiss(toastId), durationMs);
    }
    return toastId;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] })
}));

// Convenience helpers — preferred over reaching into the store directly so
// callers don't depend on the zustand API surface.
export const pushToast = (input: ToastInput) =>
  useToastStore.getState().push(input);
export const dismissToast = (id: string) =>
  useToastStore.getState().dismiss(id);
