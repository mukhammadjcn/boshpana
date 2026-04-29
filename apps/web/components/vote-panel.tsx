"use client";

import { useEffect, useMemo, useState } from "react";

const cardLabels: Record<string, string> = {
  PROFESSION: "Kasb",
  HEALTH: "Sog‘liq",
  CHARACTER: "Xarakter",
  SKILL: "Ko‘nikma",
  BAGGAGE: "Bagaj",
  FACT: "Fakt"
};

type VotePanelProps = {
  canVote: boolean;
  hasVoted: boolean;
  players: Array<{
    id: string;
    name: string;
    isAlive: boolean;
    visibleCards: Partial<Record<string, string>>;
  }>;
  meId?: string;
  onVote: (targetPlayerId: string) => void;
};

export function VotePanel({
  canVote,
  hasVoted,
  players,
  meId,
  onVote
}: VotePanelProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const options = useMemo(
    () => players.filter((player) => player.isAlive && player.id !== meId),
    [meId, players]
  );

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const selectedPlayer =
    options.find((player) => player.id === selectedPlayerId) ?? null;

  const headline = hasVoted
    ? "Siz ovoz berdingiz"
    : canVote
      ? "Kim bunkerda qolmasligi kerak?"
      : "Ovoz natijasini kuting";

  const helper = hasVoted
    ? "Qolgan o‘yinchilarni kuting."
    : canVote
      ? "Bitta o‘yinchini tanlang va tasdiqlang."
      : "Bu bosqichda siz faqat kuzatasiz.";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-base">
      <header className="sticky top-0 z-10 border-b border-line-subtle bg-bg-base/95 backdrop-blur">
        <div className="flex items-center justify-between px-5 pt-safe">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-bad">
              Ovoz berish
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">{headline}</h2>
          </div>
          <span className="rounded-full border border-line-strong bg-bg-elevated px-3 py-1.5 text-xs font-medium text-ink-secondary">
            {options.length} ta nomzod
          </span>
        </div>
        <p className="px-5 pb-3 pt-1 text-sm text-ink-secondary">{helper}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-40">
        <ul className="grid gap-3">
          {options.map((player) => {
            const entries = Object.entries(player.visibleCards).filter(
              ([, value]) => value
            );
            const active = selectedPlayerId === player.id;
            const disabled = !canVote || hasVoted;

            return (
              <li key={player.id}>
                <button
                  disabled={disabled}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] disabled:opacity-50 ${
                    active
                      ? "border-bad bg-bad/10"
                      : "border-line-subtle bg-bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-ink-primary">
                      {player.name}
                    </p>
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border ${
                        active
                          ? "border-bad bg-bad text-bg-base"
                          : "border-line-strong bg-bg-base text-transparent"
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                  </div>

                  {entries.length ? (
                    <div className="mt-3 grid gap-1.5">
                      {entries.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-baseline gap-2 text-sm"
                        >
                          <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                            {cardLabels[key] ?? key}
                          </span>
                          <span className="flex-1 text-ink-secondary">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-ink-muted">
                      Faqat kasb ochiq.
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky bottom-0 border-t border-line-subtle bg-bg-base/95 px-5 pb-safe pt-3 backdrop-blur">
        <button
          disabled={!canVote || hasVoted || !selectedPlayerId}
          onClick={() => selectedPlayerId && onVote(selectedPlayerId)}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-bad text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {hasVoted
            ? "Ovoz yuborildi"
            : selectedPlayer
              ? `${selectedPlayer.name} — tasdiqlash`
              : "Avval birini tanlang"}
        </button>
      </div>
    </div>
  );
}
