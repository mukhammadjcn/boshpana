"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";

import type { BunkerPhase } from "../bunker/bunker-types";

type DockLabel = {
  key: string;
  vars?: Record<string, string | number>;
};

type DockActionKind =
  | "start_game"
  | "start_round"
  | "start_reveals"
  | "advance_turn"
  | "start_voting"
  | "skip_voting";

type DockAction = {
  kind: DockActionKind;
  label: DockLabel;
  disabled?: boolean;
};

export type OnlineBunkerDockConfig = {
  primary: DockAction | null;
  secondary: DockAction | null;
  endLabelKey: "roomni_ochirish" | "oyinni_tugatish";
};

type ConfigInput = {
  isLobby: boolean;
  playersCount: number;
  phase?: BunkerPhase | "LOBBY";
  canStartReveals: boolean;
  canAdvanceTurn: boolean;
  advanceTurnLabelKey: "keyingi_oyinchi" | "pitchni_tugatish";
  canStartVoting: boolean;
  canSkipVoting: boolean;
  votingFinished: boolean;
};

type Props = ConfigInput & {
  onStartGame: () => void;
  onStartRound: () => void;
  onStartReveals: () => void;
  onAdvanceTurn: () => void;
  onStartVoting: () => void;
  onSkipVoting: () => void;
  onEndGame: () => void;
};

export function getOnlineBunkerDockConfig({
  isLobby,
  playersCount,
  phase,
  canStartReveals,
  canAdvanceTurn,
  advanceTurnLabelKey,
  canStartVoting,
  canSkipVoting,
  votingFinished,
}: ConfigInput): OnlineBunkerDockConfig {
  if (isLobby) {
    return {
      primary: {
        kind: "start_game",
        label:
          playersCount >= 3
            ? { key: "oyinni_boshlash" }
            : { key: "count_ta_oyinchi_kerak", vars: { count: 3 } },
        disabled: playersCount < 3,
      },
      secondary: null,
      endLabelKey: "roomni_ochirish",
    };
  }

  const primary =
    phase === "INTRO"
      ? ({ kind: "start_round", label: { key: "1_roundni_boshlash" } } as const)
      : canStartReveals
        ? ({
            kind: "start_reveals",
            label: { key: "kartalarni_ochishni_boshlash" },
          } as const)
        : canAdvanceTurn
          ? ({
              kind: "advance_turn",
              label: { key: advanceTurnLabelKey },
            } as const)
          : votingFinished && canSkipVoting
            ? ({
                kind: "skip_voting",
                label: { key: "keyingi_roundni_boshlash" },
              } as const)
            : canStartVoting
              ? ({ kind: "start_voting", label: { key: "ovoz_berish" } } as const)
              : null;

  const secondary =
    !votingFinished && canStartVoting && canSkipVoting
      ? ({ kind: "skip_voting", label: { key: "ovozsiz_keyingi_round" } } as const)
      : votingFinished && canStartVoting
        ? ({ kind: "start_voting", label: { key: "yana_ovoz_berish" } } as const)
        : null;

  return {
    primary,
    secondary,
    endLabelKey: "oyinni_tugatish",
  };
}

export function OnlineBunkerCreatorDock({
  onStartGame,
  onStartRound,
  onStartReveals,
  onAdvanceTurn,
  onStartVoting,
  onSkipVoting,
  onEndGame,
  ...input
}: Props) {
  const { t } = useI18n();
  const [pending, setPending] = useState<"primary" | "secondary" | null>(null);
  const config = getOnlineBunkerDockConfig(input);

  useEffect(() => {
    setPending(null);
  }, [
    config.primary?.kind,
    config.primary?.label.key,
    config.secondary?.kind,
    config.secondary?.label.key,
  ]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(null), 4000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const actionMap: Record<DockActionKind, () => void> = {
    start_game: onStartGame,
    start_round: onStartRound,
    start_reveals: onStartReveals,
    advance_turn: onAdvanceTurn,
    start_voting: onStartVoting,
    skip_voting: onSkipVoting,
  };

  function fire(slot: "primary" | "secondary", action: DockAction) {
    if (action.disabled || pending) return;
    setPending(slot);
    actionMap[action.kind]();
  }

  return (
    <div className="rounded-3xl border border-line-subtle bg-bg-surface p-3 shadow-pop">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-brand">
          {t("online_creator_paneli")}
        </p>
        <button
          type="button"
          onClick={onEndGame}
          className="text-xs font-medium text-bad transition active:scale-[0.98]"
        >
          {t(config.endLabelKey)}
        </button>
      </div>
      <div className="grid gap-2">
        {config.primary ? (
          <button
            type="button"
            disabled={!!config.primary.disabled || pending !== null}
            onClick={() => config.primary && fire("primary", config.primary)}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending === "primary"
              ? t("yuborilmoqda")
              : t(config.primary.label.key, config.primary.label.vars)}
          </button>
        ) : null}
        {config.secondary ? (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => config.secondary && fire("secondary", config.secondary)}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-base px-4 text-sm font-semibold text-ink-primary transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending === "secondary"
              ? t("yuborilmoqda")
              : t(config.secondary.label.key, config.secondary.label.vars)}
          </button>
        ) : null}
      </div>
    </div>
  );
}
