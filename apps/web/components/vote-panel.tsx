"use client";

import { useEffect, useMemo, useState } from "react";

import { Timer } from "@/components/timer";

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
  tiebreakCandidateIds?: string[];
  secondsLeft?: number | null;
  onVote: (targetPlayerId: string) => void;
};

export function VotePanel({
  canVote,
  hasVoted,
  players,
  meId,
  tiebreakCandidateIds = [],
  secondsLeft,
  onVote
}: VotePanelProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const tiebreakActive = tiebreakCandidateIds.length > 0;
  const meIsCandidate = !!meId && tiebreakCandidateIds.includes(meId);

  const options = useMemo(() => {
    if (tiebreakActive) {
      return players.filter(
        (player) =>
          player.isAlive &&
          player.id !== meId &&
          tiebreakCandidateIds.includes(player.id)
      );
    }
    return players.filter((player) => player.isAlive && player.id !== meId);
  }, [meId, players, tiebreakActive, tiebreakCandidateIds]);

  const tiedNames = useMemo(
    () =>
      players
        .filter((p) => tiebreakCandidateIds.includes(p.id))
        .map((p) => p.name),
    [players, tiebreakCandidateIds]
  );

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Reset selection if the active list changes (e.g. tiebreak begins).
  useEffect(() => {
    setSelectedPlayerId(null);
  }, [tiebreakActive, hasVoted]);

  const selectedPlayer =
    options.find((player) => player.id === selectedPlayerId) ?? null;

  const headline = tiebreakActive
    ? meIsCandidate
      ? "Siz tenglikdasiz"
      : hasVoted
        ? "Siz ovoz berdingiz"
        : "Qayta ovoz berish"
    : hasVoted
      ? "Siz ovoz berdingiz"
      : canVote
        ? "Kim bunkerda qolmasligi kerak?"
        : "Ovoz natijasini kuting";

  const helper = tiebreakActive
    ? meIsCandidate
      ? `Siz ${tiedNames.filter((n) => n).join(", ")} bilan teng ovoz to‘pladingiz. Qolgan o‘yinchilar bunkerda kim qolishini hal qiladi.`
      : hasVoted
        ? "Qolgan o‘yinchilarni kuting."
        : `${tiedNames.join(", ")} teng ovoz to‘pladi. Iltimos, faqat bir kishini bunkerda qoldiring.`
    : hasVoted
      ? "Qolgan o‘yinchilarni kuting."
      : canVote
        ? "Bitta o‘yinchini tanlang va tasdiqlang."
        : "Bu bosqichda siz faqat kuzatasiz.";

  const effectiveCanVote = canVote && !meIsCandidate;

  const accent = tiebreakActive ? "text-warn" : "text-bad";
  const sectionLabel = tiebreakActive ? "Qayta ovoz" : "Ovoz berish";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-base">
      <header className="sticky top-0 z-10 border-b border-line-subtle bg-bg-base/95 backdrop-blur">
        <div className="flex items-center justify-between px-5 pt-safe">
          <div>
            <p
              className={`text-xs font-medium uppercase tracking-wider ${accent}`}
            >
              {sectionLabel}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">{headline}</h2>
          </div>
          <div className="flex items-center gap-2">
            {typeof secondsLeft === "number" ? (
              <Timer
                seconds={secondsLeft}
                variant={hasVoted ? "muted" : "danger"}
              />
            ) : null}
            {!meIsCandidate ? (
              <span className="rounded-full border border-line-strong bg-bg-elevated px-3 py-1.5 text-xs font-medium text-ink-secondary">
                {options.length} ta nomzod
              </span>
            ) : null}
          </div>
        </div>
        <p className="px-5 pb-3 pt-1 text-sm text-ink-secondary">{helper}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-40">
        {tiebreakActive && !meIsCandidate ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warn/20 text-lg">
              ⚖️
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-warn">
                Teng ovoz
              </p>
              <p className="mt-1 text-sm leading-6 text-ink-primary">
                <span className="font-semibold">{tiedNames.join(", ")}</span>{" "}
                bir xil ovoz to‘pladi. Iltimos, faqat bir kishini bunkerda
                qoldiring.
              </p>
            </div>
          </div>
        ) : null}

        {meIsCandidate ? (
          <div className="rounded-2xl border border-warn/40 bg-warn/10 p-5 text-sm leading-6 text-ink-primary">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warn/20 text-xl">
                ⚖️
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-warn">
                  Tenglik
                </p>
                <p className="text-base font-semibold">
                  Siz teng ovoz to‘pladingiz
                </p>
              </div>
            </div>
            {tiedNames.length > 1 ? (
              <p className="mt-3 text-ink-secondary">
                Boshqa tenglikdagilar:{" "}
                <span className="font-semibold text-ink-primary">
                  {tiedNames.filter((n) => n !== undefined).join(", ")}
                </span>
              </p>
            ) : null}
            <p className="mt-3 text-ink-secondary">
              Bu bosqichda ovoz bera olmaysiz. Qolgan o‘yinchilar siz va boshqa
              tenglikdagilardan kim bunkerda qolishini hal qiladi.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-line-subtle bg-bg-base/60 px-3 py-2 text-xs text-ink-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
              Natijani kutmoqdasiz
            </div>
          </div>
        ) : null}

        <ul className={`grid gap-3 ${meIsCandidate ? "mt-4 hidden" : ""}`}>
          {options.map((player) => {
            const entries = Object.entries(player.visibleCards).filter(
              ([, value]) => value
            );
            const active = selectedPlayerId === player.id;
            const disabled = !effectiveCanVote || hasVoted;

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

      {meIsCandidate ? null : (
        <div className="sticky bottom-0 border-t border-line-subtle bg-bg-base/95 px-5 pb-safe pt-3 backdrop-blur">
          <button
            disabled={!effectiveCanVote || hasVoted || !selectedPlayerId}
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
      )}
    </div>
  );
}
