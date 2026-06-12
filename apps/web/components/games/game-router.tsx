"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { LoadingState } from "@/components/loading-state";
import type {
  GameType,
  RoomMode,
  RoomStatus,
  RoomVisibility,
} from "@/lib/types";
import { RoomExpiredState } from "@/components/room-expired-state";
import { useGameBrandStore } from "@/store/useGameBrandStore";

import { BunkerExperience } from "./bunker/bunker-experience";
import { MafiaExperience } from "./mafia/mafia-experience";
import { OnlineBunkerExperience } from "./online-bunker/online-bunker-experience";
import { OnlineMafiaExperience } from "./online-mafia/online-mafia-experience";
import { useI18n } from "@/lib/i18n";

type RoomInfo = {
  code: string;
  gameType: GameType;
  status: RoomStatus;
  mode: RoomMode;
  visibility: RoomVisibility;
};

type Props = {
  roomCode: string;
  view: "room" | "game";
};

export function resolveGameExperience(info: RoomInfo) {
  if (info.mode === "ONLINE") {
    switch (info.gameType) {
      case "BUNKER":
        return "online-bunker" as const;
      case "MAFIA":
        return "online-mafia" as const;
    }
  }

  switch (info.gameType) {
    case "BUNKER":
      return "bunker" as const;
    case "MAFIA":
      return "mafia" as const;
  }
}

// Resolves which per-game UI module to mount for a given room. Each game
// lives in its own folder under components/games/<name>/ and owns its
// state, sockets, and visuals end-to-end. This router fetches the
// minimal `{ gameType }` metadata first, then hands off control.
export function GameRouter({ roomCode, view }: Props) {
  const { t } = useI18n();
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setActiveGame = useGameBrandStore((s) => s.setActiveGame);

  useEffect(() => {
    let cancelled = false;
    apiRequest<RoomInfo>(`/api/rooms/${roomCode}/info`)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Xona topilmadi.");
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  // Surface the resolved game type to the top safe-area brand strip while
  // this room is mounted, and clear it when leaving the game.
  useEffect(() => {
    setActiveGame(info?.gameType ?? null);
    return () => setActiveGame(null);
  }, [info?.gameType, setActiveGame]);

  if (error) {
    return <RoomExpiredState roomCode={roomCode} detail={error} />;
  }

  if (!info) {
    return <LoadingState label={t("yuklanmoqda_2")} />;
  }

  switch (resolveGameExperience(info)) {
    case "online-bunker":
      return (
        <OnlineBunkerExperience
          key={`online-bunker:${roomCode}:${view}`}
          roomCode={roomCode}
          view={view}
          visibility={info.visibility}
        />
      );
    case "online-mafia":
      return (
        <OnlineMafiaExperience
          key={`online-mafia:${roomCode}:${view}`}
          roomCode={roomCode}
          view={view}
          visibility={info.visibility}
        />
      );
    case "bunker":
      return (
        <BunkerExperience
          key={`bunker:${roomCode}:${view}`}
          roomCode={roomCode}
          view={view}
        />
      );
    case "mafia":
      return (
        <MafiaExperience
          key={`mafia:${roomCode}:${view}`}
          roomCode={roomCode}
          view={view}
        />
      );
  }
}
