"use client";

import { useI18n } from "@/lib/i18n";

// Shared modal shown when the host cancels a room from the lobby —
// surfaced to every other participant once so they understand why the
// page suddenly shows a "finished" state. Both Bunker and Mafia route
// the user back to the dashboard from here.
type Props = {
  open: boolean;
  onDismiss: () => void;
};

export function CancelledRoomModal({ open, onDismiss }: Props) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay px-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl border border-line-strong bg-bg-surface p-6 text-center shadow-pop">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-warn/40 bg-warn/10 text-2xl">
          🚫
        </div>
        <h3 className="mt-4 text-xl font-bold text-ink-primary">
          {t("oyin_yaratilmadi")}
        </h3>
        <p className="mt-3 text-sm leading-7 text-ink-secondary">
          {t(
            "Host xonani o'yin boshlanmasdan turib tugatdi. Yangi o'yinda ishtirok etish uchun bosh sahifaga qayting."
          )}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
        >
          {t("bosh_sahifa")}
        </button>
      </div>
    </div>
  );
}
