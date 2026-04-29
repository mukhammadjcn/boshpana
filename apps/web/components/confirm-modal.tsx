"use client";

import { useEffect } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warn" | "neutral";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const toneStyles: Record<NonNullable<ConfirmModalProps["tone"]>, {
  accent: string;
  button: string;
}> = {
  danger: {
    accent: "text-bad",
    button: "bg-bad text-white"
  },
  warn: {
    accent: "text-warn",
    button: "bg-warn text-bg-base"
  },
  neutral: {
    accent: "text-brand",
    button: "bg-brand text-bg-base"
  }
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Tasdiqlash",
  cancelLabel = "Bekor qilish",
  tone = "danger",
  busy = false,
  onConfirm,
  onClose
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const styles = toneStyles[tone];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-bg-overlay backdrop-blur-md sm:items-center"
    >
      <button
        type="button"
        aria-label="Yopish"
        onClick={busy ? undefined : onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl border-t border-line-subtle bg-bg-surface p-6 pb-safe shadow-pop sm:rounded-3xl sm:border">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        <p
          className={`text-xs font-medium uppercase tracking-[0.2em] ${styles.accent}`}
        >
          Tasdiqlash kerak
        </p>
        <h2 className="mt-2 text-xl font-bold leading-snug text-ink-primary">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {description}
          </p>
        ) : null}
        <div className="mt-6 grid gap-2">
          <button
            disabled={busy}
            onClick={onConfirm}
            className={`flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 ${styles.button}`}
          >
            {busy ? "..." : confirmLabel}
          </button>
          <button
            disabled={busy}
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-elevated text-sm font-semibold text-ink-primary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
