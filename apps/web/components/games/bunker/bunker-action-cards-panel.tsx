"use client";

import { useI18n } from "@/lib/i18n";
import type { LocalizedText } from "@/lib/localized-content";
import type { BunkerActionCardView } from "./bunker-types";

type Props = {
  cards: BunkerActionCardView[];
  // Faza 2 da har doim disabled — keyingi fazalarda host/round mantiqi
  // tagidan true bo'ladi.
  canPlay?: boolean;
  onPlay?: (instanceId: string) => void;
};

const tierColors: Record<number, string> = {
  1: "border-slate-500 bg-slate-900/60",
  2: "border-amber-500 bg-amber-950/40",
  3: "border-rose-500 bg-rose-950/40"
};

const tierLabels: Record<number, string> = {
  1: "Oddiy",
  2: "O'rtacha",
  3: "Kuchli"
};

export function BunkerActionCardsPanel({ cards, canPlay = false, onPlay }: Props) {
  const { t } = useI18n();

  if (cards.length === 0) return null;

  const held = cards.filter((c) => c.status === "HELD");
  const played = cards.filter((c) => c.status === "PLAYED");

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-300">
          {t("maxsus_kartalar") ?? "Maxsus kartalar"}
        </h3>
        <span className="text-xs text-slate-400">
          {held.length} {t("qolmoqda") ?? "qolmoqda"}
        </span>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        {held.map((card) => (
          <ActionCard
            key={card.instanceId}
            card={card}
            canPlay={canPlay}
            onPlay={onPlay}
          />
        ))}
      </div>

      {played.length > 0 && (
        <div className="opacity-50">
          <div className="text-xs text-slate-500 mb-1">
            {t("ishlatilgan") ?? "Ishlatilgan"}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {played.map((card) => (
              <ActionCard key={card.instanceId} card={card} canPlay={false} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ActionCard({
  card,
  canPlay,
  onPlay
}: {
  card: BunkerActionCardView;
  canPlay: boolean;
  onPlay?: (instanceId: string) => void;
}) {
  const { language } = useI18n();
  const tone = tierColors[card.tier] ?? tierColors[1];
  const tier = tierLabels[card.tier] ?? "?";

  return (
    <div
      className={`rounded-lg border p-3 transition ${tone} ${
        canPlay ? "hover:border-amber-400 cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-sm font-semibold text-slate-100">
          {pickText(card.title, language)}
        </h4>
        <span className="text-[10px] uppercase text-slate-400">{tier}</span>
      </div>
      <p className="text-xs text-slate-300 leading-snug">
        {pickText(card.description, language)}
      </p>
      {canPlay && onPlay && (
        <button
          type="button"
          onClick={() => onPlay(card.instanceId)}
          className="mt-2 w-full text-xs bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded"
        >
          Ishlatish
        </button>
      )}
    </div>
  );
}

function pickText(text: LocalizedText, language: string): string {
  if (language === "ru" && text.ru) return text.ru;
  if (language === "en" && text.en) return text.en;
  return text.uz;
}
