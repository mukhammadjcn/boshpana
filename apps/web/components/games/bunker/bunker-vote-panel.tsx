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
  // Optimistic flag: flipped on click so the button immediately reflects
  // "Ovoz yuborildi" without waiting for the server broadcast (~150–400ms
  // round-trip on Telegram WebApp). The server's `hasVoted` prop catches
  // up shortly after; if it doesn't (network drop / rejection), we time
  // out and reset so the user can retry.
  const [optimisticVoted, setOptimisticVoted] = useState(false);
  const tiebreakActive = tiebreakCandidateIds.length > 0;
  const meIsCandidate = !!meId && tiebreakCandidateIds.includes(meId);
  const alivePlayers = useMemo(
    () => players.filter((player) => player.isAlive),
    [players]
  );
  const allAliveAreTied =
    tiebreakActive &&
    alivePlayers.length > 0 &&
    alivePlayers.every((player) => tiebreakCandidateIds.includes(player.id));
  const effectiveHasVoted = hasVoted || optimisticVoted;

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
  const otherTiedNames = useMemo(
    () =>
      players
        .filter((p) => tiebreakCandidateIds.includes(p.id) && p.id !== meId)
        .map((p) => p.name),
    [meId, players, tiebreakCandidateIds]
  );

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Reset selection if the active list changes (e.g. tiebreak begins) or
  // when the server confirms our vote (we've moved into "submitted"
  // mode). Tiebreak transition also clears the optimistic flag so the
  // button re-enables for the second round of voting.
  useEffect(() => {
    setSelectedPlayerId(null);
  }, [tiebreakActive, hasVoted]);
  useEffect(() => {
    setOptimisticVoted(false);
  }, [tiebreakActive]);

  // Auto-rollback the optimistic flag if the server hasn't confirmed within
  // 4 seconds — covers dropped sockets and explicit rejections so the user
  // can retry without a refresh.
  useEffect(() => {
    if (!optimisticVoted || hasVoted) return;
    const t = window.setTimeout(() => setOptimisticVoted(false), 4000);
    return () => window.clearTimeout(t);
  }, [optimisticVoted, hasVoted]);

  const selectedPlayer =
    options.find((player) => player.id === selectedPlayerId) ?? null;

  const helper = tiebreakActive
    ? meIsCandidate && !allAliveAreTied
      ? `Siz tenglikdasiz${
          otherTiedNames.length ? ` — ${otherTiedNames.join(", ")} bilan` : ""
        } teng ovoz to‘pladingiz. Qolgan o‘yinchilar bunkerda kim qolishini hal qiladi.`
      : allAliveAreTied
        ? "Barchaning ovozi teng bo‘ldi — endi aniq bir odamni chiqarishga harakat qiling, bo‘lmasa tizim random odamni chiqarib yuboradi."
      : effectiveHasVoted
        ? "Siz ovoz berdingiz. Qolgan o‘yinchilarni kuting."
        : `${tiedNames.join(", ")} teng ovoz to‘pladi — faqat bir kishini bunkerda qoldiring.`
    : effectiveHasVoted
      ? "Siz ovoz berdingiz. Qolgan o‘yinchilarni kuting."
      : canVote
        ? "Kim bunkerda qolmasligi kerak, uni tanlang!"
        : "Ovoz natijasini kuting — bu bosqichda siz faqat kuzatasiz.";

  const effectiveCanVote = canVote && (!meIsCandidate || allAliveAreTied);

  const accent = tiebreakActive ? "text-warn" : "text-bad";
  const sectionLabel = tiebreakActive ? "Qayta ovoz" : "Ovoz berish";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-base">
      <header className="sticky top-0 z-10 border-b border-line-subtle bg-bg-base/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-5 pt-safe">
          <p
            className={`flex-1 text-sm font-semibold uppercase tracking-[0.2em] ${accent}`}
          >
            {sectionLabel}
          </p>
          {typeof secondsLeft === "number" ? (
            <Timer
              seconds={secondsLeft}
              variant={effectiveHasVoted ? "muted" : "danger"}
            />
          ) : null}
          {!meIsCandidate ? (
            <span className="inline-flex items-center rounded-full border border-line-strong bg-bg-elevated px-3 py-1.5 text-sm font-semibold text-ink-secondary">
              {options.length} ta nomzod
            </span>
          ) : null}
        </div>
        <p className="px-5 pb-3 pt-2 text-base font-semibold leading-snug text-ink-primary">
          {helper}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-40">
        {tiebreakActive && (!meIsCandidate || allAliveAreTied) ? (
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
                bir xil ovoz to‘pladi.{" "}
                {allAliveAreTied
                  ? "Hamma tenglikda qolgani uchun qayta ovoz barcha tiriklar uchun ochildi. Bu safar bitta aniq odamni chiqarishga kelishing, aks holda random odam chiqib ketadi."
                  : "Iltimos, faqat bir kishini bunkerda qoldiring."}
              </p>
            </div>
          </div>
        ) : null}

        {meIsCandidate && !allAliveAreTied ? (
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
            {otherTiedNames.length > 0 ? (
              <p className="mt-3 text-ink-secondary">
                Boshqa tenglikdagilar:{" "}
                <span className="font-semibold text-ink-primary">
                  {otherTiedNames.join(", ")}
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

        <ul
          className={`grid gap-3 ${
            meIsCandidate && !allAliveAreTied ? "mt-4 hidden" : ""
          }`}
        >
          {options.map((player) => {
            const entries = Object.entries(player.visibleCards).filter(
              ([, value]) => value
            );
            const active = selectedPlayerId === player.id;
            const disabled = !effectiveCanVote || effectiveHasVoted;

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
            disabled={!effectiveCanVote || effectiveHasVoted || !selectedPlayerId}
            onClick={() => {
              if (!selectedPlayerId) return;
              setOptimisticVoted(true);
              onVote(selectedPlayerId);
            }}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-bad text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {effectiveHasVoted
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
