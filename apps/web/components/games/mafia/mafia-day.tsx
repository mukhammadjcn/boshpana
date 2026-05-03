"use client";

import { useMemo } from "react";

import { MafiaSituationArt } from "./mafia-situation-art";
import type { MafiaPublicState, MafiaRole } from "./mafia-types";

type Props = {
  state: MafiaPublicState;
  onAdvancePhase: () => void;
  onSubmitVote: (targetPlayerId: string) => void;
};

const roleLabel: Record<MafiaRole, string> = {
  CITIZEN: "Oddiy aholi",
  MAFIA: "Mafia",
  SHERIFF: "Komisar",
  DOCTOR: "Doktor"
};

// Kun bosqichi — muhokama (3 daq) → ovoz berish (60s) → kerak bo'lsa
// tiebreak (30s) → natija (6s reveal). Har bir sub-view alohida shell
// ichida render qilinadi.
export function MafiaDay({ state, onAdvancePhase, onSubmitVote }: Props) {
  const phase = state.game.phase;
  if (phase === "DAY_DISCUSSION") {
    return <Discussion state={state} onAdvancePhase={onAdvancePhase} />;
  }
  if (phase === "DAY_VOTE" || phase === "DAY_TIEBREAK") {
    return (
      <VoteView
        state={state}
        onSubmitVote={onSubmitVote}
        onAdvancePhase={onAdvancePhase}
      />
    );
  }
  if (phase === "DAY_RESULT") {
    return <ResultView state={state} />;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Shared shell
// ─────────────────────────────────────────────────────────────────────

function DayShell({
  title,
  subtitle,
  remaining,
  totalSeconds,
  badge,
  children
}: {
  title: string;
  subtitle: string;
  remaining: number;
  totalSeconds: number;
  badge?: string;
  children: React.ReactNode;
}) {
  const fraction = Math.max(
    0,
    Math.min(1, totalSeconds === 0 ? 0 : remaining / totalSeconds)
  );
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-5 pt-safe pb-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between pt-3">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            {title}
          </p>
          {badge ? (
            <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 font-mono text-xs">
              {badge}
            </span>
          ) : null}
        </header>

        <div>
          <p className="text-xs text-ink-muted">{subtitle}</p>
          <div className="mt-2 flex items-center justify-between">
            <span
              className={`font-mono text-lg font-bold ${
                remaining <= 10 ? "text-bad" : "text-ink-primary"
              }`}
            >
              {mins > 0
                ? `${mins}:${String(secs).padStart(2, "0")}`
                : `${secs}s`}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className={`h-full transition-all ${
                remaining <= 10 ? "bg-bad" : "bg-brand"
              }`}
              style={{ width: `${fraction * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DAY_DISCUSSION — 3-minute talk window; host can skip to vote
// ─────────────────────────────────────────────────────────────────────

function Discussion({
  state,
  onAdvancePhase
}: {
  state: MafiaPublicState;
  onAdvancePhase: () => void;
}) {
  const { game, players, me } = state;
  const aliveCount = players.filter((p) => p.isAlive).length;

  return (
    <DayShell
      title={`Kun · #${game.dayNumber}`}
      subtitle="Muhokama vaqti — kim mafia ekanligi haqida bahslashing"
      remaining={game.remainingSeconds}
      totalSeconds={180}
      badge={state.room.code}
    >
      <section className="grid gap-3 rounded-3xl border border-line-subtle bg-bg-surface p-5 text-center">
        <MafiaSituationArt src="/talkimg.webp" alt="Muhokama" />
        <p className="text-base font-semibold">
          Hozircha tirik qolganlar: {aliveCount}
        </p>
        <p className="text-sm text-ink-muted">
          Bahslashing. Mafia kim ekan?
        </p>
      </section>

      <ul className="grid gap-2">
        {players
          .filter((p) => p.isAlive)
          .map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold uppercase text-brand">
                {p.name.slice(0, 2)}
              </span>
              <span className="flex-1 truncate text-sm font-medium">
                {p.name} {me?.id === p.id ? "(siz)" : ""}
              </span>
              <span
                className={`text-[10px] font-medium uppercase tracking-wider ${
                  p.online ? "text-ok" : "text-ink-muted"
                }`}
              >
                {p.online ? "Onlayn" : "Offlayn"}
              </span>
            </li>
          ))}
      </ul>

      {me?.isHost ? (
        <button
          type="button"
          onClick={onAdvancePhase}
          className="mt-auto flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
        >
          Ovoz berish
        </button>
      ) : null}
    </DayShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DAY_VOTE / DAY_TIEBREAK — pick someone to eliminate
// ─────────────────────────────────────────────────────────────────────

function VoteView({
  state,
  onSubmitVote,
  onAdvancePhase
}: {
  state: MafiaPublicState;
  onSubmitVote: (targetPlayerId: string) => void;
  onAdvancePhase: () => void;
}) {
  const { game, players, me, votes } = state;
  const isTiebreak = game.phase === "DAY_TIEBREAK";
  const totalSeconds = isTiebreak ? 30 : 60;
  const myTargetPlayerId = votes.myTargetPlayerId;
  const myTarget = players.find((p) => p.id === myTargetPlayerId) ?? null;

  // For tiebreak, only the tied candidates are eligible. Otherwise any
  // alive non-self player can be voted.
  const candidates = useMemo(() => {
    if (isTiebreak) {
      return players.filter(
        (p) => game.tiebreakCandidateIds.includes(p.id) && p.isAlive
      );
    }
    return players.filter((p) => p.isAlive && p.id !== me?.id);
  }, [players, isTiebreak, game.tiebreakCandidateIds, me?.id]);

  const aliveCount = players.filter((p) => p.isAlive).length;

  return (
    <DayShell
      title={isTiebreak ? "Qayta ovoz · teng ovoz" : `Ovoz · Kun #${game.dayNumber}`}
      subtitle={
        isTiebreak
          ? "Tenglashgan nomzodlardan birini tanlang"
          : "Sizningcha kim mafia? Birini tanlang"
      }
      remaining={game.remainingSeconds}
      totalSeconds={totalSeconds}
      badge={`${votes.total} / ${aliveCount}`}
    >
      {!me?.isAlive ? (
        <div className="grid gap-3 rounded-3xl border border-line-strong bg-bg-surface p-5 text-center">
          <MafiaSituationArt src="/ghostimg.webp" alt="O'lgan o'yinchi" />
          <p className="text-base font-semibold">Siz o'lgansiz</p>
          <p className="text-sm text-ink-muted">
            Tomoshabin sifatida natijani kuting.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {candidates.map((p) => {
            const selected = myTargetPlayerId === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSubmitVote(p.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm transition active:scale-[0.98] ${
                    selected
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-line-strong bg-bg-surface text-ink-primary"
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold uppercase ${
                      selected
                        ? "bg-brand text-bg-base"
                        : "bg-brand-soft text-brand"
                    }`}
                  >
                    {p.name.slice(0, 2)}
                  </span>
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wider ${
                      selected ? "text-brand" : "text-ink-muted"
                    }`}
                  >
                    {selected ? "Tanlandi" : "Ovoz"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {myTarget ? (
        <p className="rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-center text-sm text-brand">
          Siz {myTarget.name}ni tanladingiz.
        </p>
      ) : null}

      <p
        className={`text-center text-xs ${
          votes.submittedByMe ? "text-ok" : "text-ink-muted"
        }`}
      >
        {votes.submittedByMe
          ? "✓ Ovozingiz qabul qilindi (qayta tanlasangiz, almashtirasiz)"
          : "Hali ovoz bermadingiz"}
      </p>

      {me?.isHost ? (
        <button
          type="button"
          onClick={onAdvancePhase}
          className="mt-auto flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-surface text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
        >
          Ovozni yakunlash
        </button>
      ) : null}
    </DayShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DAY_RESULT — eliminated player + role reveal
// ─────────────────────────────────────────────────────────────────────

function ResultView({ state }: { state: MafiaPublicState }) {
  const { game, players } = state;
  const eliminated = players.find(
    (p) => p.id === game.lastEliminatedPlayerId
  );
  const role = game.lastEliminatedRole;

  return (
    <DayShell
      title={`Kun yakunlandi · #${game.dayNumber}`}
      subtitle="Ovoz berish natijasi"
      remaining={game.remainingSeconds}
      totalSeconds={6}
      badge={state.room.code}
    >
      {eliminated && role ? (
        <div className="grid gap-3 rounded-3xl border border-bad/30 bg-bad/10 p-6 text-center animate-fade-in">
          <MafiaSituationArt src="/diedimg.webp" alt="Chetlatilgan o'yinchi" />
          <p className="text-base font-semibold text-bad">
            {eliminated.name} chetlatildi
          </p>
          <p className="text-xs text-ink-muted">Roli: {roleLabel[role]}</p>
        </div>
      ) : (
        <div className="grid gap-3 rounded-3xl border border-line-strong bg-bg-surface p-6 text-center">
          <MafiaSituationArt src="/novoiceimg.webp" alt="Hech kim chetlatilmadi" />
          <p className="text-base font-semibold">Hech kim chetlatilmadi</p>
          <p className="text-xs text-ink-muted">
            Ovozlar bo'linib ketdi yoki qayta ovoz ham tenglashdi.
          </p>
        </div>
      )}
    </DayShell>
  );
}
