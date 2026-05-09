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
import { OnlineChat } from "../shared/online-chat";
import { RoomLeaveButton } from "../shared/room-leave-button";
import type { BunkerRoomState } from "./bunker-types";

type BunkerLobbyProps = {
  room: BunkerRoomState["room"];
  players: BunkerRoomState["players"];
  me: NonNullable<BunkerRoomState["me"]>;
  roomState: BunkerRoomState;
  visibility: RoomVisibility;
  uiVariant: "friends" | "online";
  meReady: boolean;
  alivePlayersCount: number;
  connectionFeedback: ReactNode;
  error: string | null;
  onLeaveRoom: () => void;
  onSendChat: (text: string) => void;
  onToggleReady: () => void;
  onRequestKickPlayer: (player: { id: string; name: string }) => void;
};

export function BunkerLobby({
  room,
  players,
  me,
  roomState,
  visibility,
  uiVariant,
  meReady,
  alivePlayersCount,
  connectionFeedback,
  error,
  onLeaveRoom,
  onSendChat,
  onToggleReady,
  onRequestKickPlayer,
}: BunkerLobbyProps) {
  const router = useRouter();
  const { t } = useI18n();
  const isOnlineVariant = uiVariant === "online";
  // Public matchmaking rooms have no host concept from the player's
  // perspective — hide the host badge and visual distinction.
  const hideHostUi = isOnlineVariant && visibility === "PUBLIC";
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${room.code}`
      : "";
  const showLobbyShareActions =
    uiVariant === "friends" || visibility === "PRIVATE";
  const lobbyBadges = [
    {
      label: t(isOnlineVariant ? "tab_online" : "tab_dostlar_davrasi"),
      tone: isOnlineVariant ? ("brand" as const) : ("neutral" as const),
    },
    {
      label: room.isAdult ? "18+" : t("normal"),
      tone: "neutral" as const,
    },
    {
      label: t(visibility === "PUBLIC" ? "tab_public" : "tab_private"),
      tone: "neutral" as const,
    },
  ];

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      {connectionFeedback}
      <div className="mx-auto max-w-2xl px-5 pt-safe pb-[13.5rem] sm:pb-[14.5rem]">
        <header className="flex items-center justify-between py-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard" as Route)}
            className="-ml-2 flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm text-ink-secondary"
          >
            <span aria-hidden>←</span> {t("bosh_sahifa")}
          </button>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary">
              {t("lobby")}
            </span>
            {(isOnlineVariant || !me.isHost) && (
              <RoomLeaveButton onClick={onLeaveRoom} />
            )}
          </div>
        </header>

        <LobbyRoomCard
          roomCodeLabel={t("room_code")}
          roomCode={room.code}
          summary={t("players_maxplayers_oyinchi_finish_winnertarget_fefe", {
            players: players.length,
            maxPlayers: room.maxPlayers,
            winnerTarget: room.winnerTarget,
          })}
          gameLabel="Bunker"
          badges={lobbyBadges}
          actions={
            me.isHost && showLobbyShareActions ? (
              <LobbyShareActions
                roomCode={room.code}
                inviteUrl={inviteUrl}
                gameLabel="Bunker"
              />
            ) : null
          }
        />

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("oyinchilar")}</h2>
            <p className="text-xs text-ink-muted">
              {t("kamida_3_kishi_count_ta_fcb6", {
                count: alivePlayersCount,
              })}
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {players.map((player) => (
              <LobbyPlayerCard
                key={player.id}
                name={player.name}
                isHost={hideHostUi ? false : player.isHost}
                online={player.online}
                isReady={!!player.readyAt}
                isMe={player.id === me.id}
                onReport={
                  isOnlineVariant && player.id !== me.id
                    ? () =>
                        onRequestKickPlayer({ id: player.id, name: player.name })
                    : undefined
                }
                onKick={
                  me.isHost && !isOnlineVariant && player.id !== me.id
                    ? () =>
                        onRequestKickPlayer({ id: player.id, name: player.name })
                    : undefined
                }
              />
            ))}
          </ul>
        </section>

        {isOnlineVariant ? (
          <div className="mt-6 grid gap-3">
            <SharedAlert className="py-3" variant="info">
              {me.isHost && !hideHostUi
                ? t("online_lobbida_hamma_tayyor_bolsa_7195")
                : t("online_oyinda_barcha_tayy_9f6b")}
            </SharedAlert>
            <button
              type="button"
              disabled={players.length < 3}
              onClick={onToggleReady}
              className={`flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                meReady
                  ? "border border-brand/30 bg-brand-soft text-brand"
                  : "bg-brand text-bg-base"
              }`}
            >
              {meReady ? t("tayyorni_bekor_qilish") : t("tayyorman")}
            </button>
          </div>
        ) : !me.isHost ? (
          <>
            <SharedAlert className="mt-6 py-3">
              {t("host_oyinni_boshlashini_kuting")}
            </SharedAlert>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad transition active:scale-[0.99]"
            >
              {t("roomdan_chiqish")}
            </button>
          </>
        ) : null}

        {isOnlineVariant ? (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-bg-base/95 px-5 pt-3 pb-safe backdrop-blur">
            <div className="mx-auto max-w-2xl rounded-2xl border border-line-subtle bg-bg-surface p-3 shadow-pop">
              <div className="grid gap-2">
                <OnlineChat
                  meId={me.id}
                  messages={roomState.chat.messages}
                  onSend={onSendChat}
                  floating={false}
                />
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
