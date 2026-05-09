"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { LobbyShareActions } from "@/components/lobby-share-actions";
import { SharedAlert } from "@/components/shared-alert";
import { useI18n } from "@/lib/i18n";
import type { RoomVisibility } from "@/lib/types";
import { LobbyPlayerCard } from "../shared/lobby-player-card";
import { LobbyRoomCard } from "../shared/lobby-room-card";
import { RoomLeaveButton } from "../shared/room-leave-button";
import type { MafiaPublicState } from "./mafia-types";

type MafiaLobbyProps = {
  room: MafiaPublicState["room"];
  game: MafiaPublicState["game"];
  players: MafiaPublicState["players"];
  me: MafiaPublicState["me"];
  visibility: RoomVisibility;
  connectionFeedback: ReactNode;
  chatAction: ReactNode;
  startGamePending: boolean;
  readyPending: boolean;
  uiVariant: "friends" | "online";
  onStartGame: () => void;
  onToggleReady: () => void;
  onLeaveRoom: () => void;
  onRequestKickPlayer: (player: { id: string; name: string }) => void;
  onRequestEndGame: () => void;
};

export function MafiaLobby({
  room,
  game,
  players,
  me,
  visibility,
  connectionFeedback,
  chatAction,
  startGamePending,
  readyPending,
  uiVariant,
  onStartGame,
  onToggleReady,
  onLeaveRoom,
  onRequestKickPlayer,
  onRequestEndGame,
}: MafiaLobbyProps) {
  const router = useRouter();
  const { t } = useI18n();
  // Public matchmaking rooms have no host concept from the player's
  // perspective — hide the host badge and visual distinction. The
  // matchmaker is the de-facto host.
  const hideHostUi = uiVariant === "online" && visibility === "PUBLIC";
  const config = game.config;
  const specialRoles =
    config.mafiaCount +
    (config.hasSheriff ? 1 : 0) +
    (config.hasDoctor ? 1 : 0);
  const minPlayers = specialRoles + 1;
  const canStart = players.length >= minPlayers;
  const readyCount = players.filter((player) => !!player.readyAt).length;
  const meReady =
    !!me && players.some((player) => player.id === me.id && !!player.readyAt);
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${room.code}`
      : "";
  const showShareActions = uiVariant === "friends" || visibility === "PRIVATE";
  const lobbyBadges = [
    {
      label: t(uiVariant === "online" ? "tab_online" : "tab_dostlar_davrasi"),
      tone: uiVariant === "online" ? ("brand" as const) : ("neutral" as const),
    },
    {
      label: t(visibility === "PUBLIC" ? "tab_public" : "tab_private"),
      tone: "neutral" as const,
    },
  ];

  return (
    <main className="min-h-screen bg-bg-base pb-[13.5rem] pt-safe text-ink-primary sm:pb-[14.5rem]">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-5">
        <header className="flex items-center justify-between py-3 lg:py-5">
          <button
            type="button"
            onClick={() => router.push("/dashboard" as Route)}
            className="flex items-center gap-1 text-sm font-medium text-ink-secondary"
          >
            ← {t("bosh_sahifa")}
          </button>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1.5 text-xs">
              {t("lobby")}
            </span>
            {room.status !== "FINISHED" &&
            (uiVariant === "online" || !me?.isHost) ? (
              <RoomLeaveButton onClick={onLeaveRoom} />
            ) : null}
          </div>
        </header>

        <LobbyRoomCard
          roomCodeLabel={t("room_code")}
          roomCode={room.code}
          summary={t("players_maxplayers_oyinchi", {
            players: players.length,
            maxPlayers: room.maxPlayers,
          })}
          gameLabel="Mafia"
          badges={lobbyBadges}
          actions={
            showShareActions ? (
              <LobbyShareActions
                roomCode={room.code}
                inviteUrl={inviteUrl}
                gameLabel="Mafia"
              />
            ) : null
          }
        />

        <section className="mt-4 rounded-2xl border border-line-subtle bg-bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            {t("tarkib")}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <CompositionChip label="Mafia" value={config.mafiaCount} />
            <CompositionChip
              label={t("komisar_2")}
              value={config.hasSheriff ? 1 : 0}
            />
            <CompositionChip
              label={t("doktor_2")}
              value={config.hasDoctor ? 1 : 0}
            />
            <CompositionChip
              label={t("aholi")}
              value={Math.max(0, room.maxPlayers - specialRoles)}
            />
          </div>
        </section>

        <section className="mt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">{t("oyinchilar")}</h2>
            <p className="text-xs text-ink-muted">
              {t("kamida_minplayers_kishi_readycount_ta_6b25", {
                minPlayers,
                readyCount,
              })}
            </p>
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {players.map((player) => (
              <LobbyPlayerCard
                key={player.id}
                name={player.name}
                isHost={hideHostUi ? false : player.isHost}
                isMe={me?.id === player.id}
                online={player.online}
                isReady={!!player.readyAt}
                onReport={
                  uiVariant === "online" && player.id !== me?.id
                    ? () =>
                        onRequestKickPlayer({
                          id: player.id,
                          name: player.name,
                        })
                    : undefined
                }
                onKick={
                  me?.isHost &&
                  uiVariant !== "online" &&
                  player.id !== me.id &&
                  room.status === "LOBBY"
                    ? () =>
                        onRequestKickPlayer({
                          id: player.id,
                          name: player.name,
                        })
                    : undefined
                }
              />
            ))}
          </ul>
        </section>

        {uiVariant === "online" ? (
          <div className="mt-6 grid gap-3">
            <SharedAlert className="py-3">
              {me?.isHost
                ? t("online_lobbida_hamma_tayyor_bolsa_7195")
                : t("online_oyinda_barcha_tayy_9f6b")}
            </SharedAlert>
            <button
              type="button"
              disabled={!canStart || readyPending}
              onClick={onToggleReady}
              className={`flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                meReady
                  ? "border border-brand/30 bg-brand-soft text-brand"
                  : "bg-brand text-bg-base"
              }`}
            >
              {readyPending
                ? t("yuborilmoqda")
                : meReady
                  ? t("tayyorni_bekor_qilish")
                  : t("tayyorman")}
            </button>
          </div>
        ) : !me?.isHost ? (
          <div className="mt-6 grid gap-2">
            <SharedAlert className="py-3">
              {t("host_oyinni_boshlashini_kuting_2")}
            </SharedAlert>
          </div>
        ) : null}
      </div>

      {me?.isHost || uiVariant === "online" ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-bg-base/95 px-4 pt-3 pb-safe backdrop-blur">
          <div className="mx-auto max-w-2xl">
            {me?.isHost ? (
              <div className="rounded-2xl border border-line-subtle bg-bg-surface p-3 shadow-pop">
                {uiVariant !== "online" && (
                  <p className="mb-2 text-xs font-medium text-ink-muted">
                    {t("host_paneli")}
                  </p>
                )}
                {uiVariant === "online" ? (
                  <div className="grid gap-2">{chatAction}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onStartGame}
                      disabled={!canStart || startGamePending}
                      className="flex h-12 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
                    >
                      {startGamePending ? (
                        <span className="inline-flex items-center gap-2">
                          <Spinner />
                          {t("yuborilmoqda")}
                        </span>
                      ) : canStart ? (
                        t("oyinni_boshlash")
                      ) : (
                        t("count_ta_oyinchi_kerak", { count: minPlayers })
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onRequestEndGame}
                      className="flex h-12 items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad transition"
                    >
                      {t("roomni_ochirish")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-line-subtle bg-bg-surface p-3 shadow-pop">
                <div className="grid gap-2">{chatAction}</div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {connectionFeedback}
    </main>
  );
}

function CompositionChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line-strong bg-bg-base px-3 py-2">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono font-semibold text-ink-primary">{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80"
    />
  );
}
