"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";

type HostControlsProps = {
  isHost: boolean;
  isLobby?: boolean;
  canStartGame: boolean;
  canStartRound: boolean;
  canStartReveals: boolean;
  canAdvanceTurn: boolean;
  advanceTurnLabel?: string;
  canStartVoting: boolean;
  canSkipVoting: boolean;
  votingFinished: boolean;
  onStartGame: () => void;
  onStartRound: () => void;
  onStartReveals: () => void;
  onAdvanceTurn: () => void;
  onStartVoting: () => void;
  onSkipVoting: () => void;
  onEndGame: () => void;
};

export function HostControls({
  isHost,
  isLobby = false,
  canStartGame,
  canStartRound,
  canStartReveals,
  canAdvanceTurn,
  advanceTurnLabel = "Keyingi o‘yinchi",
  canStartVoting,
  canSkipVoting,
  votingFinished,
  onStartGame,
  onStartRound,
  onStartReveals,
  onAdvanceTurn,
  onStartVoting,
  onSkipVoting,
  onEndGame,
}: HostControlsProps) {
  const { t } = useI18n();
  // Optimistic pending state for host actions: clicking flips the button
  // into a "yuborilmoqda" state immediately so taps feel instant. Cleared
  // when the resulting phase change re-derives `primary`/`secondary`
  // labels, or after a 4s safety timeout if the broadcast never arrives.
  const [pending, setPending] = useState<"primary" | "secondary" | null>(null);

  // After voting resolved, the only useful host action is moving on.
  const primary = canStartGame
    ? { label: t("oyinni_boshlash"), onClick: onStartGame }
    : canStartRound
      ? { label: t("1_roundni_boshlash"), onClick: onStartRound }
      : canStartReveals
        ? { label: t("kartalarni_ochishni_boshlash"), onClick: onStartReveals }
        : canAdvanceTurn
          ? { label: t(advanceTurnLabel), onClick: onAdvanceTurn }
          : votingFinished && canSkipVoting
            ? { label: t("keyingi_roundni_boshlash"), onClick: onSkipVoting }
            : canStartVoting
              ? { label: t("ovoz_berish"), onClick: onStartVoting }
              : null;

  // Secondary action depends on whether voting already happened this round.
  // Before voting: offer to skip it. After voting: offer another vote pass
  // (useful in 8+ player games where one elimination per round is too slow).
  const secondary = !votingFinished && canStartVoting && canSkipVoting
    ? { label: t("ovozsiz_keyingi_round"), onClick: onSkipVoting }
    : votingFinished && canStartVoting
      ? { label: t("yana_ovoz_berish"), onClick: onStartVoting }
      : null;

  const endLabel = isLobby ? t("roomni_ochirish") : t("oyinni_tugatish");

  // Reset the optimistic flag when the available actions change — that's
  // our signal that the server's state broadcast landed and the new phase
  // is in effect.
  useEffect(() => {
    setPending(null);
  }, [primary?.label, secondary?.label]);

  // Safety timeout for the rare case where the broadcast never arrives
  // (dropped socket, error swallowed). Without this, a user could see a
  // stuck "Yuborilmoqda…" button forever.
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setPending(null), 4000);
    return () => window.clearTimeout(t);
  }, [pending]);

  if (!isHost) {
    return null;
  }

  const fireOptimistic = (slot: "primary" | "secondary", fn: () => void) => () => {
    setPending(slot);
    fn();
  };

  const buttonsDisabled = pending !== null;

  // No actions available outside of lobby — collapse the panel into a
  // single full-width "End game" button so the host always has a useful
  // affordance instead of empty-state filler text.
  const noActionsMidGame = !primary && !secondary && !isLobby;

  if (noActionsMidGame) {
    return (
      <button
        type="button"
        onClick={onEndGame}
        className="flex h-12 w-full items-center justify-center rounded-2xl border border-bad/40 bg-bad/10 px-4 text-sm font-semibold text-bad transition active:scale-[0.98]"
      >
        {endLabel}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line-subtle bg-bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">{t("host_paneli")}</p>
        {!isLobby ? (
          <button
            type="button"
            onClick={onEndGame}
            className="text-xs font-medium text-bad hover:underline"
          >
            {t("oyinni_tugatish")}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {primary ? (
          <button
            onClick={fireOptimistic("primary", primary.onClick)}
            disabled={buttonsDisabled}
            className="flex h-12 flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending === "primary" ? (
              <>
                <Spinner />
                {t("yuborilmoqda")}
              </>
            ) : (
              primary.label
            )}
          </button>
        ) : null}
        {secondary ? (
          <button
            onClick={fireOptimistic("secondary", secondary.onClick)}
            disabled={buttonsDisabled}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-bg-elevated px-4 text-sm font-semibold text-ink-primary transition disabled:opacity-60"
          >
            {pending === "secondary" ? (
              <>
                <Spinner />
                {t("yuborilmoqda")}
              </>
            ) : (
              secondary.label
            )}
          </button>
        ) : null}
        {isLobby ? (
          <button
            type="button"
            onClick={onEndGame}
            className="flex h-12 flex-1 min-w-[140px] items-center justify-center rounded-xl border border-bad/40 bg-bad/10 px-4 text-sm font-semibold text-bad transition active:scale-[0.98]"
          >
            {endLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70"
    />
  );
}
