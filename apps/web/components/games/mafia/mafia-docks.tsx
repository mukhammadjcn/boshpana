"use client";

import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import type { MafiaPublicState } from "./mafia-types";

export function MafiaHostDock({
  state,
  chatAction,
  suppressPrimaryAction = false,
  showManagementHeader = true,
  showRoleReminder,
  showVoteConfirmAction,
  showNightSelectionStatus,
  showResultsAction,
  primaryPending,
  confirmVotePending,
  confirmNightPending,
  onViewResults,
  onAdvancePhase,
  onEndGame,
  onOpenRole,
  onConfirmVote,
  onConfirmNight,
}: {
  state: MafiaPublicState;
  chatAction?: ReactNode;
  suppressPrimaryAction?: boolean;
  showManagementHeader?: boolean;
  showRoleReminder: boolean;
  showVoteConfirmAction: boolean;
  showNightSelectionStatus: boolean;
  showResultsAction: boolean;
  primaryPending: boolean;
  confirmVotePending: boolean;
  confirmNightPending: boolean;
  onViewResults: () => void;
  onAdvancePhase: () => void;
  onEndGame: () => void;
  onOpenRole: () => void;
  onConfirmVote: () => void;
  onConfirmNight: () => void;
}) {
  const { t } = useI18n();
  const me = state.me;
  if (!me?.isHost || state.room.status !== "PLAYING") return null;
  if (state.game.phase === "ASSIGN_ROLES" && !me.roleConfirmed) return null;

  const primaryLabel = suppressPrimaryAction
    ? null
    : getMafiaHostPrimaryLabel(state);
  const primaryDisabled =
    state.game.phase === "ASSIGN_ROLES" &&
    state.game.roleConfirmations.confirmed < state.game.roleConfirmations.total;
  const confirmDisabled =
    !state.votes.myTargetPlayerId || state.votes.confirmedByMe;
  const nightConfirmDisabled =
    !state.me?.pendingNightTargetId || state.night.confirmedByMe;
  const roleButton = showRoleReminder ? (
    <button
      type="button"
      onClick={onOpenRole}
      className="flex h-12 min-w-[148px] items-center justify-center rounded-2xl border border-line-strong bg-bg-base px-4 text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
    >
      {t("mening_kartam")}
    </button>
  ) : null;
  const hasDockPair = !!chatAction && !!roleButton;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-bg-base/95 px-4 pt-3 pb-safe backdrop-blur">
      <div className="mx-auto max-w-2xl rounded-2xl border border-line-subtle bg-bg-surface p-3 shadow-pop">
        {showManagementHeader ? (
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-ink-muted">
              {t("host_paneli")}
            </p>
            <button
              type="button"
              onClick={onEndGame}
              className="text-xs font-medium text-bad transition active:scale-[0.98]"
            >
              {t("oyinni_tugatish")}
            </button>
          </div>
        ) : null}
        {primaryLabel ? (
          <div
            className={`grid gap-2 ${
              showRoleReminder && !hasDockPair
                ? "grid-cols-[minmax(0,1fr)_auto]"
                : "grid-cols-1"
            }`}
          >
            <button
              type="button"
              onClick={onAdvancePhase}
              disabled={primaryDisabled || primaryPending}
              className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
            >
              {primaryPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {t("yuborilmoqda")}
                </span>
              ) : (
                t(primaryLabel)
              )}
            </button>
            {!hasDockPair ? roleButton : null}
          </div>
        ) : null}
        {!primaryLabel && showResultsAction ? (
          <div
            className={`mt-2 grid gap-2 ${
              showRoleReminder && !hasDockPair
                ? "grid-cols-[minmax(0,1fr)_auto]"
                : "grid-cols-1"
            }`}
          >
            <button
              type="button"
              onClick={onViewResults}
              className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("oyin_natijalarini_korish")}
            </button>
            {!hasDockPair ? roleButton : null}
          </div>
        ) : null}
        {!primaryLabel &&
        !showResultsAction &&
        (showVoteConfirmAction ||
          showNightSelectionStatus ||
          showRoleReminder) ? (
          <div
            className={`mt-2 grid gap-2 ${
              (showVoteConfirmAction || showNightSelectionStatus) &&
              showRoleReminder &&
              !hasDockPair
                ? "grid-cols-[minmax(0,1fr)_auto]"
                : "grid-cols-1"
            }`}
          >
            {showVoteConfirmAction ? (
              <button
                type="button"
                onClick={onConfirmVote}
                disabled={confirmDisabled || confirmVotePending}
                className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
              >
                {confirmVotePending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    {t("yuborilmoqda")}
                  </span>
                ) : state.votes.confirmedByMe ? (
                  t("tasdiqlandi")
                ) : (
                  t("ovozni_tasdiqlash")
                )}
              </button>
            ) : showNightSelectionStatus ? (
              <button
                type="button"
                onClick={onConfirmNight}
                disabled={nightConfirmDisabled || confirmNightPending}
                className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
              >
                {confirmNightPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    {t("yuborilmoqda")}
                  </span>
                ) : state.night.confirmedByMe ? (
                  t("tasdiqlandi")
                ) : state.me?.pendingNightTargetId ? (
                  t("tungi_qarorni_tasdiqlash")
                ) : (
                  t("nishonni_tanlang")
                )}
              </button>
            ) : null}
            {!hasDockPair ? roleButton : null}
          </div>
        ) : null}
        {hasDockPair ? (
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_148px] gap-2">
            {chatAction}
            {roleButton}
          </div>
        ) : chatAction ? (
          <div className="mt-2">{chatAction}</div>
        ) : null}
      </div>
    </div>
  );
}

export function MafiaPlayerDock({
  state,
  chatAction,
  showRoleReminder,
  showVoteConfirmAction,
  showNightSelectionStatus,
  showResultsAction,
  confirmVotePending,
  confirmNightPending,
  onViewResults,
  onOpenRole,
  onConfirmVote,
  onConfirmNight,
}: {
  state: MafiaPublicState;
  chatAction?: ReactNode;
  showRoleReminder: boolean;
  showVoteConfirmAction: boolean;
  showNightSelectionStatus: boolean;
  showResultsAction: boolean;
  confirmVotePending: boolean;
  confirmNightPending: boolean;
  onViewResults: () => void;
  onOpenRole: () => void;
  onConfirmVote: () => void;
  onConfirmNight: () => void;
}) {
  const { t } = useI18n();
  const me = state.me;
  if (!me || me.isHost || !showRoleReminder) return null;

  const confirmDisabled =
    !state.votes.myTargetPlayerId || state.votes.confirmedByMe;
  const nightConfirmDisabled =
    !state.me?.pendingNightTargetId || state.night.confirmedByMe;
  const roleButton = (
    <button
      type="button"
      onClick={onOpenRole}
      className="flex h-12 min-w-[148px] items-center justify-center rounded-2xl border border-line-strong bg-bg-surface px-4 text-sm font-semibold text-ink-primary shadow-pop transition active:scale-[0.98]"
    >
      {t("mening_kartam")}
    </button>
  );
  const hasDockPair = !!chatAction;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-bg-base/95 px-4 pt-3 pb-safe backdrop-blur">
      <div className="mx-auto max-w-2xl">
        <div
          className={`grid gap-2 ${
            (showVoteConfirmAction ||
              showNightSelectionStatus ||
              showResultsAction) &&
            !hasDockPair
              ? "grid-cols-[minmax(0,1fr)_auto]"
              : "grid-cols-1"
          }`}
        >
          {showResultsAction ? (
            <button
              type="button"
              onClick={onViewResults}
              className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("oyin_natijalarini_korish")}
            </button>
          ) : showVoteConfirmAction ? (
            <button
              type="button"
              onClick={onConfirmVote}
              disabled={confirmDisabled || confirmVotePending}
              className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
            >
              {confirmVotePending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {t("yuborilmoqda")}
                </span>
              ) : state.votes.confirmedByMe ? (
                t("tasdiqlandi")
              ) : (
                t("ovozni_tasdiqlash")
              )}
            </button>
          ) : showNightSelectionStatus ? (
            <button
              type="button"
              onClick={onConfirmNight}
              disabled={nightConfirmDisabled || confirmNightPending}
              className="flex h-12 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
            >
              {confirmNightPending ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {t("yuborilmoqda")}
                </span>
              ) : state.night.confirmedByMe ? (
                t("tasdiqlandi")
              ) : state.me?.pendingNightTargetId ? (
                t("tungi_qarorni_tasdiqlash")
              ) : (
                t("nishonni_tanlang")
              )}
            </button>
          ) : null}
          {!hasDockPair ? roleButton : null}
        </div>
        {hasDockPair ? (
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_148px] gap-2">
            {chatAction}
            {roleButton}
          </div>
        ) : chatAction ? (
          <div className="mt-2">{chatAction}</div>
        ) : null}
      </div>
    </div>
  );
}

function getMafiaHostPrimaryLabel(
  state: MafiaPublicState | null,
): string | null {
  if (!state?.me?.isHost || state.room.status !== "PLAYING") return null;
  if (state.game.phase === "DAY_RESULT" && state.game.winner) return null;
  switch (state.game.phase) {
    case "ASSIGN_ROLES":
      return "tunni_boshlash";
    case "NIGHT_RESULT":
      return "kunni_boshlash";
    case "DAY_DISCUSSION":
      return "ovoz_berishni_boshlash";
    case "DAY_RESULT":
      return "keyingi_tunni_boshlash";
    default:
      return null;
  }
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80"
    />
  );
}
