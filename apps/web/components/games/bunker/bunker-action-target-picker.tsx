"use client";

import { useI18n } from "@/lib/i18n";

import { GameModalShell } from "../shared/game-modal-shell";
import type { BunkerActionCardView } from "./bunker-types";

type TargetCandidate = {
  id: string;
  name: string;
  isMe: boolean;
};

type Props = {
  open: boolean;
  card: BunkerActionCardView | null;
  // Tirik o'yinchilar ro'yxati.
  candidates: TargetCandidate[];
  onCancel: () => void;
  onConfirm: (targetPlayerId: string) => void;
};

/**
 * V2 effektlar uchun target picker modali.
 * - `targetScope === "OTHER"` bo'lsa, o'zingdan tashqari tirik o'yinchilar.
 * - `targetScope === "ANY"` bo'lsa, o'zing ham bo'ladi.
 */
export function BunkerActionTargetPicker({
  open,
  card,
  candidates,
  onCancel,
  onConfirm,
}: Props) {
  const { t, language } = useI18n();

  if (!open || !card) return null;

  const filtered = candidates.filter((p) => {
    if (card.targetScope === "OTHER") return !p.isMe;
    return true;
  });

  const title =
    language === "ru" ? card.title.ru : language === "en" ? card.title.en : card.title.uz;

  return (
    <GameModalShell
      align="sheet"
      zIndexClassName="z-50"
      overlayClassName="bg-bg-overlay backdrop-blur-sm animate-overlay-in"
      panelClassName="w-full max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-line-subtle bg-bg-surface px-5 pt-4 pb-safe animate-sheet-in"
      onBackdropClick={onCancel}
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-brand">
          {t("kimga_ishlatamiz") ?? "Kimga ishlatamiz?"}
        </p>
        <h2 className="mt-0.5 text-lg font-semibold text-ink-primary">{title}</h2>
      </div>

      <div className="grid gap-2">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-line-subtle bg-bg-base p-4 text-center text-sm text-ink-muted">
            {t("nomzodlar_yoq") ?? "Mos nomzodlar yo'q"}
          </p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onConfirm(p.id)}
              className="flex items-center justify-between rounded-2xl border border-line-strong bg-bg-base p-3 text-left transition active:scale-[0.99] hover:border-brand"
            >
              <span className="text-sm font-semibold text-ink-primary">
                {p.name}
                {p.isMe ? (
                  <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-brand">
                    {t("siz_2")}
                  </span>
                ) : null}
              </span>
              <span className="text-ink-muted">→</span>
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-4 w-full rounded-xl border border-line-strong bg-bg-base py-3 text-sm font-medium text-ink-secondary transition active:scale-[0.98]"
      >
        {t("bekor_qilish")}
      </button>
    </GameModalShell>
  );
}
