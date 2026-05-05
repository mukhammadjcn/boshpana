"use client";

import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { MafiaSituationArt } from "./mafia-situation-art";
import type { MafiaPublicState, MafiaRole } from "./mafia-types";

type Props = {
  state: MafiaPublicState;
  onSubmitVote: (targetPlayerId: string) => void;
  voteSubmitPending?: boolean;
};

function getRoleLabel(t: (text: string, vars?: Record<string, string | number>) => string): Record<MafiaRole, string> {
  return {
    CITIZEN: t("oddiy_aholi"),
    MAFIA: t("mafia_2"),
    SHERIFF: t("komisar_2"),
    DOCTOR: t("doktor_2")
  };
}

// Kun bosqichi — muhokama (4 daq) → ovoz berish (60s) → kerak bo'lsa
// tiebreak (30s) → natija (6s reveal). Har bir sub-view alohida shell
// ichida render qilinadi.
export function MafiaDay({
  state,
  onSubmitVote,
  voteSubmitPending = false
}: Props) {
  const phase = state.game.phase;
  if (phase === "DAY_DISCUSSION") {
    return <Discussion state={state} />;
  }
  if (phase === "DAY_VOTE" || phase === "DAY_TIEBREAK") {
    return (
      <VoteView
        state={state}
        onSubmitVote={onSubmitVote}
        voteSubmitPending={voteSubmitPending}
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
  const { t } = useI18n();
  const fraction = Math.max(
    0,
    Math.min(1, totalSeconds === 0 ? 0 : remaining / totalSeconds)
  );
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div
        className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-5 pt-safe sm:px-6 lg:px-8"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10.5rem)" }}
      >
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
                : t("seconds_s", { seconds: secs })}
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
// DAY_DISCUSSION — 4-minute talk window; host can skip to vote
// ─────────────────────────────────────────────────────────────────────

function Discussion({ state }: { state: MafiaPublicState }) {
  const { t } = useI18n();
  const { game, players, me } = state;
  const aliveCount = players.filter((p) => p.isAlive).length;

  return (
    <DayShell
      title={t("kun_number_daynumber", { dayNumber: game.dayNumber })}
      subtitle={t("muhokama_vaqti_kim_mafia_ekanligi_508d")}
      remaining={game.remainingSeconds}
      totalSeconds={240}
      badge={state.room.code}
    >
      <section className="grid gap-3 rounded-3xl border border-line-subtle bg-bg-surface p-5 text-center">
        <MafiaSituationArt src="/talkimg.webp" alt={t("muhokama")} />
        <p className="text-base font-semibold">
          {t("hozircha_tirik_qolganlar_count", { count: aliveCount })}
        </p>
        <p className="text-sm text-ink-muted">
          {t("bahslashing_mafia_kim_ekan")}
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
                {p.name} {me?.id === p.id ? t("siz") : ""}
              </span>
              <span
                className={`text-[10px] font-medium uppercase tracking-wider ${
                  p.online ? "text-ok" : "text-ink-muted"
                }`}
              >
                {p.online ? t("onlayn") : t("offlayn")}
              </span>
            </li>
          ))}
      </ul>

    </DayShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DAY_VOTE / DAY_TIEBREAK — pick someone to eliminate
// ─────────────────────────────────────────────────────────────────────

function VoteView({
  state,
  onSubmitVote,
  voteSubmitPending = false
}: {
  state: MafiaPublicState;
  onSubmitVote: (targetPlayerId: string) => void;
  voteSubmitPending?: boolean;
}) {
  const { t } = useI18n();
  const { game, players, me, votes } = state;
  const isTiebreak = game.phase === "DAY_TIEBREAK";
  const totalSeconds = 60;
  const myTargetPlayerId = votes.myTargetPlayerId;
  const [optimisticTargetId, setOptimisticTargetId] = useState<string | null>(
    myTargetPlayerId
  );
  const selectedLocked = votes.confirmedByMe;
  const alivePlayers = players.filter((p) => p.isAlive);
  const meIsCandidate =
    !!me?.id && game.tiebreakCandidateIds.includes(me.id);
  const allAliveAreTied =
    isTiebreak &&
    alivePlayers.length > 0 &&
    alivePlayers.every((player) => game.tiebreakCandidateIds.includes(player.id));
  const canVoteInTiebreak = !meIsCandidate || allAliveAreTied;

  useEffect(() => {
    setOptimisticTargetId(myTargetPlayerId);
  }, [myTargetPlayerId]);

  // For tiebreak, only the tied candidates are eligible. Otherwise any
  // alive non-self player can be voted.
  const candidates = useMemo(() => {
    if (isTiebreak) {
      return players.filter(
        (p) =>
          game.tiebreakCandidateIds.includes(p.id) &&
          p.isAlive &&
          p.id !== me?.id
      );
    }
    return players.filter((p) => p.isAlive && p.id !== me?.id);
  }, [players, isTiebreak, game.tiebreakCandidateIds, me?.id]);
  const tiedNames = players
    .filter((player) => game.tiebreakCandidateIds.includes(player.id))
    .map((player) => player.name);
  const otherTiedNames = players
    .filter(
      (player) =>
        game.tiebreakCandidateIds.includes(player.id) && player.id !== me?.id
    )
    .map((player) => player.name);

  return (
    <DayShell
      title={
        isTiebreak
          ? t("qayta_ovoz_teng_ovoz")
          : t("ovoz_kun_number_daynumber", { dayNumber: game.dayNumber })
      }
      subtitle={
        isTiebreak
          ? t("tenglashgan_nomzodlardan_birini_tanlang")
          : t("sizningcha_kim_mafia_birini_tanlang")
      }
      remaining={game.remainingSeconds}
      totalSeconds={totalSeconds}
      badge={`${votes.confirmations.confirmed} / ${votes.confirmations.total}`}
    >
      {!me?.isAlive ? (
        <SpectatorPanel
          players={players}
          title={t("siz_olgansiz")}
          subtitle={t("tomoshabin_sifatida_ovoz_natijasini_va_bd94")}
        />
      ) : (
        <>
          {isTiebreak && meIsCandidate && !allAliveAreTied ? (
            <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm leading-6 text-ink-primary">
              <p className="text-[11px] font-medium uppercase tracking-wider text-warn">
                {t("tenglik")}
              </p>
              <p className="mt-1 text-base font-semibold">
                {t("siz_teng_ovoz_topladingiz")}
              </p>
              {otherTiedNames.length > 0 ? (
                <p className="mt-2 text-ink-secondary">
                  {t("boshqa_tenglikdagilar")}{" "}
                  <span className="font-semibold text-ink-primary">
                    {otherTiedNames.join(", ")}
                  </span>
                </p>
              ) : null}
              <p className="mt-2 text-ink-secondary">
                {t("bu_bosqichda_ovoz_bera_olmaysiz_67a0")}
              </p>
            </div>
          ) : null}

          {isTiebreak && (!meIsCandidate || allAliveAreTied) ? (
            <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm leading-6 text-ink-primary">
              <p className="text-[11px] font-medium uppercase tracking-wider text-warn">
                {t("teng_ovoz")}
              </p>
              <p className="mt-1">
                <span className="font-semibold">{tiedNames.join(", ")}</span>{" "}
                {t("bir_xil_ovoz_topladi")}
              </p>
            </div>
          ) : null}

          {(!isTiebreak || canVoteInTiebreak) ? (
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {candidates.map((p) => {
                const selected = optimisticTargetId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOptimisticTargetId(p.id);
                        onSubmitVote(p.id);
                      }}
                      disabled={selectedLocked || voteSubmitPending}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm transition active:scale-[0.98] ${
                        selected
                          ? "border-brand bg-brand/15 text-brand"
                          : "border-line-strong bg-bg-surface text-ink-primary"
                      } disabled:opacity-55`}
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
                        {selected && voteSubmitPending
                          ? t("yuborilmoqda")
                          : selected
                            ? t("tanlandi")
                            : t("ovoz")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}

      <div className="rounded-2xl border border-line-subtle bg-bg-surface px-4 py-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          {t("tasdiqlanganlar")}
        </p>
        <p className="mt-1 font-mono text-lg font-semibold text-brand">
          {votes.confirmations.confirmed} / {votes.confirmations.total}
        </p>
      </div>

      <p
        className={`text-center text-xs ${
          isTiebreak && meIsCandidate && !allAliveAreTied
            ? "text-ink-muted"
            : votes.confirmedByMe
            ? "text-ok"
            : votes.submittedByMe
              ? "text-brand"
              : "text-ink-muted"
        }`}
      >
        {isTiebreak && meIsCandidate && !allAliveAreTied
          ? t("natijani_kutmoqdasiz")
          : votes.confirmedByMe
          ? t("ovozingiz_tasdiqlandi")
          : votes.submittedByMe
            ? t("nomzod_tanlandi_endi_tasdiqlang")
          : t("hali_ovoz_bermadingiz")}
      </p>

      {me?.isAlive ? <div className="mt-auto h-2" /> : null}
    </DayShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DAY_RESULT — eliminated player + role reveal
// ─────────────────────────────────────────────────────────────────────

function ResultView({ state }: { state: MafiaPublicState }) {
  const { t } = useI18n();
  const { game, players } = state;
  const eliminated = players.find(
    (p) => p.id === game.lastEliminatedPlayerId
  );
  const role = game.lastEliminatedRole;
  const roleLabel = getRoleLabel(t);

  return (
    <DayShell
      title={t("kun_yakunlandi_number_daynumber", { dayNumber: game.dayNumber })}
      subtitle={t("ovoz_berish_natijasi")}
      remaining={game.remainingSeconds}
      totalSeconds={6}
      badge={state.room.code}
    >
      {eliminated && role ? (
        <div className="grid gap-3 rounded-3xl border border-bad/30 bg-bad/10 p-6 text-center animate-fade-in">
          <MafiaSituationArt src="/diedimg.webp" alt={t("chetlatilgan_oyinchi")} />
          <p className="text-base font-semibold text-bad">
            {t("name_chetlatildi", { name: eliminated.name })}
          </p>
          <p className="text-xs text-ink-muted">
            {t("roli_role", { role: roleLabel[role] })}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 rounded-3xl border border-line-strong bg-bg-surface p-6 text-center">
          <MafiaSituationArt src="/novoiceimg.webp" alt={t("hech_kim_chetlatilmadi")} />
          <p className="text-base font-semibold">{t("hech_kim_chetlatilmadi")}</p>
          <p className="text-xs text-ink-muted">
            {t("ovozlar_bolinib_ketdi_yoki_qayta_3993")}
          </p>
        </div>
      )}
    </DayShell>
  );
}

function SpectatorPanel({
  players,
  title,
  subtitle
}: {
  players: MafiaPublicState["players"];
  title: string;
  subtitle: string;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 rounded-3xl border border-line-strong bg-bg-surface p-5">
      <div className="grid gap-3 text-center">
        <MafiaSituationArt src="/ghostimg.webp" alt={t("olgan_oyinchi")} />
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-ink-muted">{subtitle}</p>
      </div>

      <div className="grid gap-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-2xl border border-line-subtle bg-bg-base/60 px-3 py-2"
          >
            <span className="truncate text-sm font-medium">{player.name}</span>
            <span
              className={`text-[11px] font-medium uppercase tracking-wider ${
                player.isAlive ? "text-ok" : "text-bad"
              }`}
            >
              {player.isAlive ? t("tirik") : t("olgan")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
