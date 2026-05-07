"use client";

import { useEffect, useMemo, useState } from "react";

import { Timer } from "@/components/timer";
import { useI18n } from "@/lib/i18n";
import { GameActionModal } from "@/components/games/shared/game-action-modal";
import { MafiaSituationArt } from "./mafia-situation-art";
import type { MafiaPublicState, MafiaRole } from "./mafia-types";

type Props = {
  state: MafiaPublicState;
  onSubmitVote: (targetPlayerId: string) => void;
  onReportPlayer?: (playerId: string) => void;
  voteSubmitPending?: boolean;
  confirmVotePending?: boolean;
  onConfirmVote?: () => void;
  onOpenRole?: () => void;
  headerAction?: React.ReactNode;
};

function getRoleLabel(
  t: (text: string, vars?: Record<string, string | number>) => string,
): Record<MafiaRole, string> {
  return {
    CITIZEN: t("oddiy_aholi"),
    MAFIA: t("mafia_2"),
    SHERIFF: t("komisar_2"),
    DOCTOR: t("doktor_2"),
  };
}

// Kun bosqichi — muhokama (4 daq) → ovoz berish (60s) → kerak bo'lsa
// tiebreak (30s) → natija (6s reveal). Har bir sub-view alohida shell
// ichida render qilinadi.
export function MafiaDay({
  state,
  onSubmitVote,
  onReportPlayer,
  voteSubmitPending = false,
  confirmVotePending = false,
  onConfirmVote,
  onOpenRole,
  headerAction
}: Props) {
  const phase = state.game.phase;
  if (phase === "DAY_DISCUSSION") {
    return <Discussion state={state} onReportPlayer={onReportPlayer} headerAction={headerAction} />;
  }
  if (phase === "DAY_VOTE" || phase === "DAY_TIEBREAK") {
    return (
      <VoteView
        state={state}
        onSubmitVote={onSubmitVote}
        onReportPlayer={onReportPlayer}
        voteSubmitPending={voteSubmitPending}
        confirmVotePending={confirmVotePending}
        onConfirmVote={onConfirmVote}
        onOpenRole={onOpenRole}
        headerAction={headerAction}
      />
    );
  }
  if (phase === "DAY_RESULT") {
    return <ResultView state={state} headerAction={headerAction} />;
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
  accentTone = "warn",
  badge,
  headerAction,
  children,
}: {
  title: string;
  subtitle: string;
  remaining: number;
  accentTone?: "brand" | "warn" | "bad";
  badge?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const timerVariant =
    remaining <= 30 ? "danger" : remaining <= 90 ? "warning" : "default";
  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div
        className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-5 pt-safe sm:px-6 lg:px-8"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10.5rem)" }}
      >
        <header className="sticky top-0 z-10 -mx-5 border-b border-line-subtle bg-bg-base/95 px-5 pt-safe pb-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-xs font-medium uppercase tracking-[0.25em] ${
                accentTone === "bad"
                  ? "text-bad"
                  : accentTone === "brand"
                    ? "text-brand"
                    : "text-warn"
              }`}
            >
              {title}
            </p>
            <div className="flex items-center gap-2">
              <Timer seconds={remaining} variant={timerVariant} />
              {badge ? (
                <span className="inline-flex h-9 min-w-[124px] items-center justify-center rounded-full border border-line-strong bg-bg-surface px-4 font-mono text-sm font-semibold uppercase tracking-[0.22em] text-ink-secondary">
                  #{badge}
                </span>
              ) : null}
              {headerAction}
            </div>
          </div>
          <p className="mt-4 text-lg font-semibold leading-snug text-ink-primary sm:text-2xl">
            {subtitle}
          </p>
        </header>

        <div className="flex flex-1 flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DAY_DISCUSSION — 4-minute talk window; host can skip to vote
// ─────────────────────────────────────────────────────────────────────

function Discussion({
  state,
  onReportPlayer,
  headerAction,
}: {
  state: MafiaPublicState;
  onReportPlayer?: (playerId: string) => void;
  headerAction?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { game, players, me } = state;
  const aliveCount = players.filter((p) => p.isAlive).length;

  return (
    <DayShell
      title={t("kun_number_daynumber", { dayNumber: game.dayNumber })}
      subtitle={t("muhokama_vaqti_kim_mafia_ekanligi_508d")}
      remaining={game.remainingSeconds}
      accentTone="warn"
      badge={state.room.code}
      headerAction={headerAction}
    >
      <section className="grid gap-3 rounded-3xl border border-line-subtle bg-bg-surface p-5 text-center">
        <MafiaSituationArt src="/mafia/talk.webp" alt={t("muhokama")} />
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
              {onReportPlayer && p.id !== me?.id ? (
                <button
                  type="button"
                  onClick={() => onReportPlayer(p.id)}
                  aria-label={t("kick_uchun_ovoz_boshlash")}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-warn/30 bg-warn/10 text-[10px] text-warn transition active:scale-[0.98]"
                >
                  !
                </button>
              ) : null}
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
  onReportPlayer,
  voteSubmitPending = false,
  confirmVotePending = false,
  onConfirmVote,
  onOpenRole,
  headerAction
}: {
  state: MafiaPublicState;
  onSubmitVote: (targetPlayerId: string) => void;
  onReportPlayer?: (playerId: string) => void;
  voteSubmitPending?: boolean;
  confirmVotePending?: boolean;
  onConfirmVote?: () => void;
  onOpenRole?: () => void;
  headerAction?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { game, players, me, votes } = state;
  const isTiebreak = game.phase === "DAY_TIEBREAK";
  const myTargetPlayerId = votes.myTargetPlayerId;
  const [optimisticTargetId, setOptimisticTargetId] = useState<string | null>(
    myTargetPlayerId
  );
  const selectedLocked = votes.confirmedByMe;
  const alivePlayers = players.filter((p) => p.isAlive);
  const meIsCandidate = !!me?.id && game.tiebreakCandidateIds.includes(me.id);
  const allAliveAreTied =
    isTiebreak &&
    alivePlayers.length > 0 &&
    alivePlayers.every((player) =>
      game.tiebreakCandidateIds.includes(player.id)
    );
  const canVoteInTiebreak = !meIsCandidate || allAliveAreTied;
  const confirmDisabled = !votes.myTargetPlayerId || votes.confirmedByMe;
  const voteToneClass = isTiebreak
    ? {
        selectedCard: "border-warn bg-warn/10",
        selectedIcon: "border-warn bg-warn text-bg-base",
        count: "text-warn",
        status: "text-warn",
      }
    : {
        selectedCard: "border-bad bg-bad/10",
        selectedIcon: "border-bad bg-bad text-white",
        count: "text-bad",
        status: "text-bad",
      };

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
          p.id !== me?.id,
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
  const helper = !me?.isAlive
    ? t("tomoshabin_sifatida_ovoz_natijasini_va_bd94")
    : isTiebreak
      ? meIsCandidate && !allAliveAreTied
        ? otherTiedNames.length > 0
          ? t("siz_tenglikdasiz_names_bilan_teng_2297", {
              names: otherTiedNames.join(", ")
            })
          : t("natijani_kutmoqdasiz")
        : allAliveAreTied
          ? t("barchaning_ovozi_teng_boldi_endi_814d")
          : votes.confirmedByMe
            ? t("ovozingiz_tasdiqlandi")
            : votes.submittedByMe
              ? t("nomzod_tanlandi_endi_tasdiqlang")
              : t("names_teng_ovoz_topladi_faqat_04f4", {
                  names: tiedNames.join(", ")
                })
      : votes.confirmedByMe
        ? t("ovozingiz_tasdiqlandi")
        : votes.submittedByMe
          ? t("nomzod_tanlandi_endi_tasdiqlang")
          : t("sizningcha_kim_mafia_birini_tanlang");

  return (
    <GameActionModal
      sectionLabel={
        isTiebreak
          ? t("qayta_ovoz_teng_ovoz")
          : t("ovoz_kun_number_daynumber", { dayNumber: game.dayNumber })
      }
      helper={helper}
      accentTone={isTiebreak ? "warn" : "bad"}
      secondsLeft={game.remainingSeconds}
        timerVariant={
          votes.confirmedByMe
            ? "muted"
            : game.remainingSeconds <= 15
              ? "danger"
              : game.remainingSeconds <= 35
                ? "warning"
                : "default"
        }
      badge={
        <span className="inline-flex items-center rounded-full border border-line-strong bg-bg-elevated px-3 py-1.5 font-mono text-sm font-semibold text-ink-secondary">
          {votes.confirmations.confirmed} / {votes.confirmations.total}
        </span>
      }
      headerAction={headerAction}
      footer={
        me?.isAlive ? (
          <div
            className={`grid gap-2 ${
              onOpenRole ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"
            }`}
          >
            {isTiebreak && meIsCandidate && !allAliveAreTied ? (
              <div className="flex h-14 items-center justify-center rounded-2xl border border-line-subtle bg-bg-elevated px-4 text-sm font-medium text-ink-muted">
                {t("natijani_kutmoqdasiz")}
              </div>
            ) : (
              <button
                type="button"
                onClick={onConfirmVote}
                disabled={confirmDisabled || confirmVotePending}
                className="flex h-14 min-w-0 items-center justify-center rounded-2xl bg-bad px-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
              >
                {confirmVotePending
                  ? t("yuborilmoqda")
                  : votes.confirmedByMe
                    ? t("tasdiqlandi")
                    : votes.submittedByMe
                      ? t("ovozni_tasdiqlash")
                      : t("avval_birini_tanlang")}
              </button>
            )}
            {onOpenRole ? (
              <button
                type="button"
                onClick={onOpenRole}
                className="flex h-14 min-w-[132px] items-center justify-center rounded-2xl border border-line-strong bg-bg-surface px-4 text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
              >
                {t("mening_kartam")}
              </button>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="grid gap-4">
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

            {!isTiebreak || canVoteInTiebreak ? (
              <ul className="grid gap-3">
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
                        className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                          selected
                            ? voteToneClass.selectedCard
                            : "border-line-strong bg-bg-surface"
                        } disabled:opacity-55`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-ink-primary">
                              {p.name}
                            </p>
                            <p className="mt-1 text-xs text-ink-muted">
                              {selected && voteSubmitPending
                                ? t("yuborilmoqda")
                                : selected
                                  ? t("tanlandi")
                                  : t("ovoz")}
                            </p>
                          </div>
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                              selected
                                ? voteToneClass.selectedIcon
                                : "border-line-strong bg-bg-base text-transparent"
                            }`}
                            aria-hidden
                          >
                            ✓
                          </span>
                        </div>
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
          <p className={`mt-1 font-mono text-lg font-semibold ${voteToneClass.count}`}>
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
                  ? voteToneClass.status
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
      </div>
    </GameActionModal>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DAY_RESULT — eliminated player + role reveal
// ─────────────────────────────────────────────────────────────────────

function ResultView({
  state,
  headerAction,
}: {
  state: MafiaPublicState;
  headerAction?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { game, players } = state;
  const eliminated = players.find((p) => p.id === game.lastEliminatedPlayerId);
  const role = game.lastEliminatedRole;
  const roleLabel = getRoleLabel(t);

  return (
    <DayShell
      title={t("kun_yakunlandi_number_daynumber", {
        dayNumber: game.dayNumber,
      })}
      subtitle={t("ovoz_berish_natijasi")}
      remaining={game.remainingSeconds}
      accentTone="bad"
      badge={state.room.code}
      headerAction={headerAction}
    >
      {eliminated && role ? (
        <div className="grid gap-3 rounded-3xl border border-bad/30 bg-bad/10 p-6 text-center animate-fade-in">
          <MafiaSituationArt
            src="/mafia/died.webp"
            alt={t("chetlatilgan_oyinchi")}
          />
          <p className="text-base font-semibold text-bad">
            {t("name_chetlatildi", { name: eliminated.name })}
          </p>
          <p className="text-xs text-ink-muted">
            {t("roli_role", { role: roleLabel[role] })}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 rounded-3xl border border-line-strong bg-bg-surface p-6 text-center">
          <p className="text-base font-semibold">
            {t("hech_kim_chetlatilmadi")}
          </p>
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
  subtitle,
}: {
  players: MafiaPublicState["players"];
  title: string;
  subtitle: string;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 rounded-3xl border border-line-strong bg-bg-surface p-5">
      <div className="grid gap-3 text-center">
        <MafiaSituationArt src="/mafia/ghost.webp" alt={t("olgan_oyinchi")} />
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
