"use client";

import { useToastStore } from "@/store/useToastStore";

const toneByKind = {
  info: "border-line-strong bg-bg-elevated text-ink-primary",
  success: "border-ok/40 bg-ok/15 text-ok",
  warn: "border-warn/40 bg-warn/15 text-warn",
  error: "border-bad/40 bg-bad/15 text-bad"
} as const;

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Bottom-centered stack, sits above bottom nav / sticky bars. Clicks
      // pass through the wrapper so we don't block the UI behind us; only
      // the toast pills themselves are interactive.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-safe"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          className={`pointer-events-auto animate-fade-in max-w-sm w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-pop backdrop-blur ${toneByKind[toast.kind]}`}
        >
          {toast.text}
        </button>
      ))}
    </div>
  );
}
