"use client";

import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  onLeave: () => void;
  onRequestEndGame: () => void;
};

export function OnlineExitSheet({
  open,
  onClose,
  onLeave,
  onRequestEndGame
}: Props) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-bg-overlay backdrop-blur-md sm:items-center"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label={t("yopish")}
      />
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl border-t border-line-subtle bg-bg-surface p-6 pb-safe shadow-pop sm:rounded-3xl sm:border">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="grid gap-2">
          <button
            type="button"
            onClick={onLeave}
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-elevated text-base font-semibold text-ink-primary"
          >
            {t("oyindan_chiqish")}
          </button>
          <button
            type="button"
            onClick={onRequestEndGame}
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-bad/40 bg-bad/10 text-base font-semibold text-bad"
          >
            {t("oyinni_tugatishni_taklif_qilish")}
          </button>
        </div>
      </div>
    </div>
  );
}
