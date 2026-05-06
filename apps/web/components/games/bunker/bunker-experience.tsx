"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { CancelledRoomModal } from "@/components/cancelled-room-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { LobbyShareActions } from "@/components/lobby-share-actions";
import { RoomExpiredState } from "@/components/room-expired-state";
import { TelegramChrome } from "@/components/telegram-chrome";
import { useI18n } from "@/lib/i18n";
import {
  getLocalizedText,
  type LocalizedText,
  type SupportedLanguage
} from "@/lib/localized-content";
import { HostControls } from "./bunker-host-controls";
import { PlayerCard } from "./bunker-player-card";
import { Timer } from "@/components/timer";
import { getAuthToken, getAuthUser } from "@/lib/auth";
import {
  tgHaptic,
  tgHapticNotify
} from "@/lib/telegram";
import { VotePanel } from "./bunker-vote-panel";
import { useGameAudio } from "./use-bunker-audio";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { getOrCreateSessionId } from "@/lib/storage";
import type { BunkerCardType, BunkerPhase, BunkerRoomState } from "./bunker-types";
import { useGameStore } from "./use-bunker-store";
import { pushToast } from "@/store/useToastStore";
import {
  RealtimeConnectionFeedback,
  useRealtimeConnectionRecovery
} from "../shared/realtime-connection-feedback";
import type { RoomVisibility } from "@/lib/types";

const BUNKER_ONLINE_MODAL_TIMINGS_MS = {
  intro: 12000,
  situation: 9000
} as const;

// Disaster banner mapping. Image filenames in /public are tied to the
// seeded disaster names — keep this in sync with data.md when new
// disasters are added. A missing entry simply falls back to the
// text-only modal layout.
const disasterImage: Record<string, string> = {
  "Yadro urushi": "/bunker/disasters/yadro-urushi.webp",
  "Global virus": "/bunker/disasters/global-virus.webp",
  "AI isyoni": "/bunker/disasters/ai-isyoni.webp",
  "Muz davri": "/bunker/disasters/muz-davri.webp",
  "Issiq apokalipsis": "/bunker/disasters/issiq-apokalipsis.webp",
  "Zombi apokalipsisi": "/bunker/disasters/zombi-apokalipsisi.webp",
  "Demografik kollaps": "/bunker/adult/demografik-banner.webp",
  "Jinsiy tanlash epidemiyasi": "/bunker/adult/jinsiy-banner.webp",
  "Narkotik urushi": "/bunker/adult/narkotik-banner.webp"
};

const cardLabels: Record<BunkerCardType, string> = {
  PROFESSION: "Kasb",
  HEALTH: "Sog‘liq",
  CHARACTER: "Xarakter",
  SKILL: "Ko‘nikma",
  BAGGAGE: "Bagaj",
  FACT: "Fakt"
};

const cardOrder: BunkerCardType[] = [
  "PROFESSION",
  "HEALTH",
  "CHARACTER",
  "SKILL",
  "BAGGAGE",
  "FACT"
];

const phaseHelp: Record<BunkerPhase, string> = {
  LOBBY: "Lobby — kuting",
  INTRO: "Tanishuv",
  ROUND_REVEAL: "Karta ochish navbati",
  ROUND_PITCH: "Pitch — 2 daqiqa",
  ROUND_COMPLETE: "Round yakuni",
  VOTING: "Ovoz berish",
  FINISHED: "Yakun"
};

type BunkerExperienceProps = {
  roomCode: string;
  view: "room" | "game";
  uiVariant?: "friends" | "online";
  visibility?: RoomVisibility;
};

type Announcement = {
  key: string;
  title: string;
  description: string;
};

function localizeCardMap(
  cards: Partial<Record<string, LocalizedText>>,
  language: SupportedLanguage
): Partial<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(cards).map(([key, value]) => [key, getLocalizedText(value, language)])
  );
}

export function BunkerExperience({
  roomCode,
  view,
  uiVariant = "friends",
  visibility = "PRIVATE"
}: BunkerExperienceProps) {
  const router = useRouter();
  const { language, t } = useI18n();
  const isOnlineVariant = uiVariant === "online";
  const normalizedRoomCode = roomCode.toUpperCase();
  const [sessionId, setSessionId] = useState("");
  const [joinName, setJoinName] = useState("");
  // Initialize loading=false if zustand store already has fresh state for this
  // room. This bridges the unavoidable remount when status changes flip the
  // route between /room/CODE and /game/CODE — without it, every transition
  // flashes the "Room yuklanmoqda…" screen.
  const [loading, setLoading] = useState(() => {
    const cached = useGameStore.getState().roomState;
    return !cached || cached.room.code !== normalizedRoomCode;
  });
  const [origin, setOrigin] = useState("");
  const [socketConnected, setSocketConnected] = useState(true);
  const [introOpen, setIntroOpen] = useState(false);
  const [situationOpen, setSituationOpen] = useState(false);
  const [situationClosing, setSituationClosing] = useState(false);
  const [myCardsOpen, setMyCardsOpen] = useState(false);
  const [myCardsClosing, setMyCardsClosing] = useState(false);
  const [eliminatedModalOpen, setEliminatedModalOpen] = useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [cancelledModalOpen, setCancelledModalOpen] = useState(false);
  const [endGameConfirmOpen, setEndGameConfirmOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [kickedModalOpen, setKickedModalOpen] = useState(false);
  const [kickTarget, setKickTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const isLeavingRef = useRef(false);
  const previousMeRef = useRef<BunkerRoomState["me"]>(null);
  const [revealModal, setRevealModal] = useState<{
    playerId: string;
    playerName: string;
    newCardType: BunkerCardType;
    newCardValue: string;
    olderCards: Array<{ type: BunkerCardType; value: string }>;
  } | null>(null);

  const connectedRef = useRef(false);
  const seenSituationKeysRef = useRef<Set<string>>(new Set());
  const seenRevealAnnouncementRef = useRef<Set<string>>(new Set());
  const seenElimAnnouncementRef = useRef<Set<string>>(new Set());
  const seenSelfEliminationRef = useRef<Set<string>>(new Set());
  const seenWinnerModalRef = useRef<Set<string>>(new Set());
  const seenCancelledModalRef = useRef<Set<string>>(new Set());
  const playersRef = useRef<
    Array<
      Omit<BunkerRoomState["players"][number], "visibleCards" | "revealedCards"> & {
        visibleCards: Partial<Record<string, string>>;
        revealedCards: Partial<Record<string, string>>;
      }
    >
  >([]);

  const bottomBarRef = useRef<HTMLDivElement | null>(null);
  const bottomBarObserverRef = useRef<ResizeObserver | null>(null);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);

  // Callback ref + ResizeObserver — measures the moment the node attaches
  // (no race with effect deps) and tracks every subsequent size change.
  const setBottomBarNode = useCallback((node: HTMLDivElement | null) => {
    bottomBarObserverRef.current?.disconnect();
    bottomBarObserverRef.current = null;
    bottomBarRef.current = node;
    if (!node) return;
    setBottomBarHeight(node.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setBottomBarHeight(node.offsetHeight);
    });
    ro.observe(node);
    bottomBarObserverRef.current = ro;
  }, []);

  const cachedRoomState = useGameStore((state) => state.roomState);
  const error = useGameStore((state) => state.error);
  const setRoomState = useGameStore((state) => state.setRoomState);
  const patchTimer = useGameStore((state) => state.patchTimer);
  const setError = useGameStore((state) => state.setError);
  const roomState =
    cachedRoomState?.room.code === normalizedRoomCode ? cachedRoomState : null;
  const refreshState = useCallback(() => {
    if (!sessionId) return;
    void apiRequest<BunkerRoomState>(
      `/api/rooms/${roomCode}/state?sessionId=${sessionId}`
    )
      .then((state) => {
        setRoomState(state);
        setLoading(false);
      })
      .catch(() => undefined);
  }, [roomCode, sessionId, setRoomState]);

  const reconnectSocket = useCallback(() => {
    if (!sessionId) return;
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
      return;
    }
    refreshState();
  }, [refreshState, sessionId]);

  // Init session + origin
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    setOrigin(window.location.origin);
  }, []);

  // Detect kicked player
  useEffect(() => {
    const prevMe = previousMeRef.current;
    const currentMe = roomState?.me;
    const status = roomState?.room.status;

    if (
      prevMe &&
      !currentMe &&
      status !== "CANCELLED" &&
      status !== "FINISHED" &&
      !isLeavingRef.current
    ) {
      setKickedModalOpen(true);
    }
    previousMeRef.current = currentMe ?? null;
  }, [roomState?.me, roomState?.room.status]);

  // Clear store state if the cached room belongs to a different code — this
  // happens when navigating between rooms and prevents a flash of stale data.
  useEffect(() => {
    const cached = useGameStore.getState().roomState;
    if (cached && cached.room.code !== normalizedRoomCode) {
      setRoomState(null);
    }
  }, [normalizedRoomCode, setRoomState]);

  useEffect(() => {
    setIntroOpen(false);
    setSituationOpen(false);
    setSituationClosing(false);
    setMyCardsOpen(false);
    setMyCardsClosing(false);
    setEliminatedModalOpen(false);
    setWinnerModalOpen(false);
    setCancelledModalOpen(false);
    setEndGameConfirmOpen(false);
    setLeaveConfirmOpen(false);
    setKickedModalOpen(false);
    setKickTarget(null);
    setAnnouncement(null);
    setRevealModal(null);
    previousMeRef.current = null;
    seenSituationKeysRef.current.clear();
    seenRevealAnnouncementRef.current.clear();
    seenElimAnnouncementRef.current.clear();
    seenSelfEliminationRef.current.clear();
    seenWinnerModalRef.current.clear();
    seenCancelledModalRef.current.clear();
  }, [normalizedRoomCode]);

  // Initial state load
  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    void (async () => {
      try {
        const state = await apiRequest<BunkerRoomState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`
        );
        if (active) setRoomState(state);
      } catch (nextError) {
        if (active) setError((nextError as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [roomCode, sessionId, setError, setRoomState]);

  // Warm the browser cache for every disaster banner while the user
  // sits in the lobby — by the time the host triggers the game, the
  // intro modal can flash its artwork instantly. We hit the raw .webp
  // URLs (not the /_next/image variant) so the underlying file is
  // cached even when the optimized version is requested later.
  useEffect(() => {
    for (const src of Object.values(disasterImage)) {
      const img = new window.Image();
      img.src = src;
    }
  }, []);

  // Prefill the join form from the cached auth profile so the user only
  // needs to confirm — they don't have to type the name from scratch.
  useEffect(() => {
    if (joinName) return;
    const authUser = getAuthUser();
    const fallback =
      authUser?.nickname ??
      authUser?.firstName ??
      authUser?.telegramUsername ??
      "";
    if (fallback) setJoinName(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket
  useEffect(() => {
    if (!sessionId || connectedRef.current) return;

    const socket = getSocket();
    let isReconnect = false;

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit("join_room", { roomCode, sessionId });
      if (isReconnect) {
        // Recover any broadcasts missed during the disconnect window.
        refreshState();
      }
      isReconnect = true;
    };

    const onDisconnect = () => {
      setSocketConnected(false);
    };

    const onState = (s: BunkerRoomState) => {
      if (s.room.code !== normalizedRoomCode) return;
      setRoomState(s);
      setLoading(false);
    };
    const onTimer = ({ remainingSeconds }: { remainingSeconds: number }) => {
      patchTimer(remainingSeconds);
    };
    const onErr = ({ message }: { message: string }) => {
      // Surface server-side action errors as a transient toast — the inline
      // error banner is easy to miss on tall screens, while a bottom toast
      // catches the eye and dismisses itself.
      pushToast({ kind: "error", text: message });
      setError(message);
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // Tab came back into focus — reconnect if dropped, AND refetch state
      // (the broadcast we missed while hidden may have been the only chance
      // to learn about a phase change).
      if (!socket.connected) {
        socket.connect();
      } else {
        refreshState();
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_state", onState);
    socket.on("timer_update", onTimer);
    socket.on("action_error", onErr);
    document.addEventListener("visibilitychange", onVisibility);
    socket.connect();
    connectedRef.current = true;

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_state", onState);
      socket.off("timer_update", onTimer);
      socket.off("action_error", onErr);
      document.removeEventListener("visibilitychange", onVisibility);
      connectedRef.current = false;
    };
  }, [
    normalizedRoomCode,
    patchTimer,
    refreshState,
    roomCode,
    sessionId,
    setError,
    setRoomState
  ]);

  // Auto-route based on status
  useEffect(() => {
    if (!roomState) return;
    if (view === "room" && roomState.room.status !== "LOBBY") {
      router.replace(`/game/${roomCode}`);
    }
    if (view === "game" && roomState.room.status === "LOBBY") {
      router.replace(`/room/${roomCode}`);
    }
  }, [roomCode, roomState, router, view]);

  // Open intro overlay when entering INTRO
  useEffect(() => {
    if (roomState?.game.phase === "INTRO") setIntroOpen(true);
  }, [roomState?.game.phase]);

  useEffect(() => {
    if (!isOnlineVariant || !introOpen) return;
    const timer = window.setTimeout(() => {
      setIntroOpen(false);
    }, BUNKER_ONLINE_MODAL_TIMINGS_MS.intro);
    return () => window.clearTimeout(timer);
  }, [introOpen, isOnlineVariant]);

  // Open situation overlay when new situation appears
  useEffect(() => {
    if (roomState?.room.status !== "PLAYING") {
      setSituationOpen(false);
      return;
    }
    const situation = roomState.game.situation;
    if (!situation || roomState.game.roundNumber < 1) return;

    const key = `${roomCode}-${roomState.game.roundNumber}-${situation.id}`;
    if (seenSituationKeysRef.current.has(key)) return;

    seenSituationKeysRef.current.add(key);
    setSituationOpen(true);
  }, [
    roomCode,
    roomState?.game.roundNumber,
    roomState?.game.situation,
    roomState?.room.status
  ]);

  const closeSituation = useCallback(() => {
    if (!situationOpen || situationClosing) return;
    setSituationClosing(true);
  }, [situationClosing, situationOpen]);

  useEffect(() => {
    if (!situationClosing) return;
    const timer = window.setTimeout(() => {
      setSituationOpen(false);
      setSituationClosing(false);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [situationClosing]);

  useEffect(() => {
    if (!isOnlineVariant || !situationOpen || situationClosing) return;
    const timer = window.setTimeout(() => {
      setSituationClosing(true);
    }, BUNKER_ONLINE_MODAL_TIMINGS_MS.situation);
    return () => window.clearTimeout(timer);
  }, [isOnlineVariant, situationClosing, situationOpen]);

  // Keep latest players in a ref so announcement effects can read names
  // without re-running on every socket update.
  useEffect(() => {
    playersRef.current = (roomState?.players ?? []).map((player) => ({
      ...player,
      visibleCards: localizeCardMap(player.visibleCards, language),
      revealedCards: localizeCardMap(player.revealedCards, language)
    }));
  }, [language, roomState?.players]);

  // Reveal announcement — opens a centred modal showing the player's
  // freshly revealed card (highlighted) alongside their previously-shown
  // cards. Players see this for everyone except themselves (they already
  // know what they revealed).
  useEffect(() => {
    if (
      !roomState?.game.lastRevealedPlayerId ||
      !roomState.game.lastRevealedCardType
    )
      return;

    const playerId = roomState.game.lastRevealedPlayerId;
    const cardType = roomState.game.lastRevealedCardType;
    const key = `${roomState.game.roundNumber}-${playerId}-${cardType}`;
    if (seenRevealAnnouncementRef.current.has(key)) return;

    const player = playersRef.current.find((p) => p.id === playerId);
    if (!player) return;
    // Don't show the modal to the player who actually revealed the card.
    if (roomState.me?.id === playerId) {
      seenRevealAnnouncementRef.current.add(key);
      return;
    }

    const newCardValue = player.revealedCards?.[cardType] ?? "";
    if (!newCardValue) return;

    const olderCards: Array<{ type: BunkerCardType; value: string }> = Object
      .entries(player.revealedCards ?? {})
      .filter(([t, v]) => t !== cardType && !!v)
      .map(([t, v]) => ({ type: t as BunkerCardType, value: v as string }));

    seenRevealAnnouncementRef.current.add(key);
    tgHaptic("light");
    setRevealModal({
      playerId,
      playerName: player.name,
      newCardType: cardType,
      newCardValue,
      olderCards
    });
  }, [
    roomState?.game.lastRevealedCardType,
    roomState?.game.lastRevealedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me?.id
  ]);

  // Elimination announcement — only re-fires when the actual elimination changes.
  useEffect(() => {
    if (!roomState?.game.lastEliminatedPlayerId) return;
    const key = `eliminated-${roomState.game.roundNumber}-${roomState.game.lastEliminatedPlayerId}`;
    if (seenElimAnnouncementRef.current.has(key)) return;

    const player = playersRef.current.find(
      (p) => p.id === roomState.game.lastEliminatedPlayerId
    );
    if (!player) return;

    seenElimAnnouncementRef.current.add(key);
    // Light haptic so non-eliminated players feel the moment the round
    // resolved. The eliminated player gets a stronger error notification
    // from the dedicated self-elimination effect, so guard against firing
    // both for them.
    const meId = roomState.me?.id;
    if (!meId || meId !== roomState.game.lastEliminatedPlayerId) {
      tgHaptic("medium");
    }
    setAnnouncement({
      key,
      title: t("name_oyindan_chiqdi", { name: player.name }),
      description: t(
        "Bu o'yinchi endi ovoz bera olmaydi, lekin kuzatishda davom etadi."
      )
    });
  }, [
    t,
    roomState?.game.lastEliminatedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me?.id
  ]);

  // Auto-clear announcement after a fixed delay; runs only when the
  // announcement itself changes (not on every players update).
  useEffect(() => {
    if (!announcement) return;
    const key = announcement.key;
    const t = window.setTimeout(() => {
      setAnnouncement((c) => (c?.key === key ? null : c));
    }, 4500);
    return () => window.clearTimeout(t);
  }, [announcement]);

  // Open the "you were eliminated" modal once when it's me who got cut.
  useEffect(() => {
    const elimId = roomState?.game.lastEliminatedPlayerId;
    const meId = roomState?.me?.id;
    if (!elimId || !meId || elimId !== meId) return;
    const key = `self-elim-${roomState?.game.roundNumber}-${meId}`;
    if (seenSelfEliminationRef.current.has(key)) return;
    seenSelfEliminationRef.current.add(key);
    tgHapticNotify("error");
    setEliminatedModalOpen(true);
  }, [
    roomState?.game.lastEliminatedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me?.id
  ]);

  // Open the "game over" modal once per finished game for every participant —
  // winners and eliminated alike. Content branches on isAlive below.
  useEffect(() => {
    if (roomState?.room.status !== "FINISHED") return;
    if (!roomState.me) return;
    const code = roomState.room.code;
    const meId = roomState.me.id;
    const key = `gameover-${code}-${meId}`;
    if (seenWinnerModalRef.current.has(key)) return;
    seenWinnerModalRef.current.add(key);
    setWinnerModalOpen(true);
  }, [
    roomState?.room.status,
    roomState?.room.code,
    roomState?.me?.id
  ]);

  // Lobby vaqtida host xonani tugatib yuborsa room CANCELLED bo'ladi va
  // o'yin umuman boshlanmaydi. Har bir ishtirokchiga "o'yin yaratilmadi"
  // modal bir marta chiqsin va bosh sahifaga yo'naltirsin.
  useEffect(() => {
    if (roomState?.room.status !== "CANCELLED") return;
    if (!roomState.me) return;
    const code = roomState.room.code;
    const meId = roomState.me.id;
    const key = `cancelled-${code}-${meId}`;
    if (seenCancelledModalRef.current.has(key)) return;
    seenCancelledModalRef.current.add(key);
    setCancelledModalOpen(true);
  }, [
    roomState?.room.status,
    roomState?.room.code,
    roomState?.me?.id
  ]);

  // Audio
  const meRevealKey = useMemo(() => {
    if (
      !roomState?.game?.lastRevealedPlayerId ||
      !roomState.me ||
      roomState.game.lastRevealedPlayerId !== roomState.me.id
    ) {
      return null;
    }
    return `${roomState.game.roundNumber}-${roomState.me.id}-${roomState.game.lastRevealedCardType ?? ""}`;
  }, [
    roomState?.game.lastRevealedCardType,
    roomState?.game.lastRevealedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me
  ]);

  const meEliminationKey = useMemo(() => {
    if (
      !roomState?.game?.lastEliminatedPlayerId ||
      !roomState.me ||
      roomState.game.lastEliminatedPlayerId !== roomState.me.id
    ) {
      return null;
    }
    return `eliminated-${roomState.game.roundNumber}-${roomState.me.id}`;
  }, [
    roomState?.game.lastEliminatedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me
  ]);

  const situationKey = useMemo(() => {
    const s = roomState?.game.situation;
    if (!s || (roomState?.game.roundNumber ?? 0) < 1) return null;
    return `${roomCode}-${roomState?.game.roundNumber}-${s.id}`;
  }, [roomCode, roomState?.game.roundNumber, roomState?.game.situation]);

  const { audioEnabled, toggleAudio } = useGameAudio({
    introOpen,
    situationOpen,
    situationKey,
    situationRound: roomState?.game.roundNumber ?? null,
    votingActive: roomState?.game.phase === "VOTING",
    meRevealKey,
    meEliminationKey
  });

  // Helpers
  async function joinWithName(name: string) {
    await apiRequest(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      body: JSON.stringify({ name, sessionId })
    });
    const socket = getSocket();
    socket.emit("join_room", { roomCode, sessionId });
    refreshState();
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Blur the active input so the on-screen keyboard collapses before the
    // network call kicks in — feels noticeably snappier on mobile.
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    try {
      await joinWithName(joinName.trim());
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  function emit(event: string, payload?: Record<string, unknown>) {
    const socket = getSocket();
    socket.emit(event, { roomCode, sessionId, ...(payload ?? {}) });
  }

  const inviteUrl = roomState ? `${origin || ""}/room/${roomState.room.code}` : "";
  const {
    browserOnline,
    showRecoveryModal,
    retryNow,
    reloadPage
  } = useRealtimeConnectionRecovery({
    enabled: !!sessionId,
    connected: socketConnected,
    onReconnect: reconnectSocket,
    onRefreshState: refreshState
  });
  const connectionFeedback = (
    <RealtimeConnectionFeedback
      connected={socketConnected}
      browserOnline={browserOnline}
      showRecoveryModal={showRecoveryModal}
      onRetryNow={retryNow}
      onReloadPage={reloadPage}
    />
  );

  // Derived
  const room = roomState?.room;
  const me = roomState?.me;
  const game = roomState?.game;
  const showLobbyShareActions = !isOnlineVariant || visibility === "PRIVATE";
  const closingConfirmation =
    !!room &&
    room.status !== "FINISHED" &&
    room.status !== "CANCELLED";
  const players = roomState?.players ?? [];
  const readyCount = players.filter((player) => !!player.readyAt).length;
  const meReady = !!me && players.some((player) => player.id === me.id && !!player.readyAt);
  const localizedPlayers = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        visibleCards: localizeCardMap(player.visibleCards, language),
        revealedCards: localizeCardMap(player.revealedCards, language)
      })),
    [language, players]
  );
  const alivePlayers = players.filter((p) => p.isAlive);
  const currentTurnPlayer = players.find(
    (p) => p.id === game?.currentTurnPlayerId
  );
  const localizedDisasterName = game?.disaster
    ? getLocalizedText(game.disaster.name, language)
    : "";
  const localizedDisasterDescription = game?.disaster
    ? getLocalizedText(game.disaster.description, language)
    : "";
  const localizedSituationText = game?.situation
    ? getLocalizedText(game.situation.text, language)
    : "";

  const myCards = useMemo(() => {
    if (!me) return [];
    return cardOrder.map((type) => ({
      type,
      label: t(cardLabels[type]),
      value: getLocalizedText(me.cards[type], language),
      isRevealed: me.revealed.includes(type)
    }));
  }, [language, me, t]);
  const myVisibleCards = useMemo(
    () =>
      Object.fromEntries(
        myCards
          .filter((card) => card.isRevealed)
          .map((card) => [card.type, card.value])
      ) as Partial<Record<BunkerCardType, string>>,
    [myCards]
  );
  const isFinished = roomState?.room.status === "FINISHED";
  const displayPlayers = useMemo(() => {
    if (!me) return localizedPlayers;
    const selfPlayer = localizedPlayers.find((p) => p.id === me.id);
    const others = localizedPlayers.filter((p) => p.id !== me.id);
    if (!selfPlayer) return localizedPlayers;
    return [
      {
        ...selfPlayer,
        visibleCards: isFinished ? selfPlayer.visibleCards : myVisibleCards
      },
      ...others
    ];
  }, [isFinished, localizedPlayers, me, myVisibleCards]);

  const revealOptions = useMemo(
    () =>
      myCards.filter(
        (c) => c.type !== "PROFESSION" && !me?.revealed.includes(c.type)
      ),
    [me?.revealed, myCards]
  );

  const isMyRevealTurn =
    !!me &&
    me.isAlive &&
    game?.phase === "ROUND_REVEAL" &&
    game.currentTurnPlayerId === me.id;
  const canVote = !!me && me.isAlive && game?.phase === "VOTING";
  const shouldShowRevealOverlay = isMyRevealTurn && !situationOpen;
  const winners = players.filter((p) => p.isAlive);
  const myRevealedCount = me?.revealed.length ?? 0;

  const roundRevealTarget = (game?.roundNumber ?? 0) + 1;
  const hasMoreRevealPlayers = players.some(
    (p) =>
      p.isAlive &&
      p.id !== game?.currentTurnPlayerId &&
      p.revealedCount < roundRevealTarget
  );

  // After resolveVoting we land back in ROUND_COMPLETE but with an
  // elimination set — that's the signal that the host's only job is to
  // start the next round.
  const votingFinished =
    game?.phase === "ROUND_COMPLETE" && !!game.lastEliminatedPlayerId;
  const canStartRevealsHost =
    me?.isHost &&
    room?.status === "PLAYING" &&
    game?.phase === "ROUND_REVEAL" &&
    !game.currentTurnPlayerId;

  const openMyCards = useCallback(() => {
    setMyCardsOpen(true);
    setMyCardsClosing(false);
  }, []);

  const closeMyCards = useCallback(() => {
    if (!myCardsOpen || myCardsClosing) return;
    setMyCardsClosing(true);
  }, [myCardsClosing, myCardsOpen]);

  useEffect(() => {
    if (!myCardsOpen || myCardsClosing) return;
    const timer = window.setTimeout(() => {
      setMyCardsClosing(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [myCardsClosing, myCardsOpen]);

  useEffect(() => {
    if (!myCardsClosing) return;
    const timer = window.setTimeout(() => {
      setMyCardsOpen(false);
      setMyCardsClosing(false);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [myCardsClosing]);

  // Loading & error states. Order matters: only show the spinner when we
  // truly have nothing to render. If the store still has state (e.g. we just
  // remounted because of a /room ↔ /game navigation), keep rendering the real
  // UI to avoid a flash.
  if (!roomState || !room || !game) {
    if (loading) {
      return (
        <main className="grid min-h-screen place-items-center bg-bg-base text-ink-secondary">
          <TelegramChrome backHref="/dashboard" />
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
            {t("room_yuklanmoqda")}
          </div>
        </main>
      );
    }
    return <RoomExpiredState roomCode={roomCode} detail={error} />;
  }

  if (!me) {
    if (kickedModalOpen) {
      return (
        <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay px-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-3xl border border-bad/40 bg-bg-surface p-6 text-center shadow-pop">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-bad/40 bg-bad/10 text-2xl text-bad">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </div>
              <h3 className="mt-4 text-xl font-bold text-ink-primary">
                {t("sizni_oyindan_chiqarishdi")}
              </h3>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                {t("host_sizni_oyindan_chiqarib_yubordi_f51a")}
              </p>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
              >
                {t("bosh_sahifa")}
              </button>
            </div>
          </div>
        </main>
      );
    }

    if (room.status !== "LOBBY") {
      const finished = room.status === "FINISHED" || room.status === "CANCELLED";
      return (
        <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
          <div className="mx-auto max-w-md pt-6">
            <p
              className={`text-xs font-medium uppercase tracking-wider ${finished ? "text-bad" : "text-warn"}`}
            >
              {finished ? t("yopiq") : t("boshlangan")}
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {finished
                ? t("bu_oyin_yakunlangan")
                : t("bu_oyin_allaqachon_boshlangan")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              {finished
                ? t("yangi_oyin_yarating_yoki_ochiq_e3ed")
                : t("oyin_boshlanganidan_keyin_yangi_oyinchi_7a2b")}
            </p>

            <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <p className="text-xs text-ink-muted">{t("room_code")}</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
                {roomCode}
              </p>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("bosh_sahifa")}
            </button>
          </div>
        </main>
      );
    }

    if (!getAuthToken()) {
      const loginHref = `/login?redirect=${encodeURIComponent(`/room/${roomCode}`)}`;
      return (
        <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
          <div className="mx-auto max-w-md pt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("taklif")}
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {t("roomga_kirish_uchun_tizimga_kiring")}
            </h1>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              {t("roomga_qoshilish_uchun_bot_orqali_123f")}
            </p>

            <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <p className="text-xs text-ink-muted">{t("room_code")}</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
                {roomCode}
              </p>
            </div>

            <a
              href={loginHref}
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              <span aria-hidden>✈</span>
              {t("telegramda_kirish")}
            </a>
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
        <div className="mx-auto max-w-md pt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-brand">
            {t("taklif")}
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {t("roomga_kirish_uchun_nickname_yozing")}
          </h1>

          <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            <p className="text-xs text-ink-muted">{t("room_code")}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
              {roomCode}
            </p>
          </div>

          <form onSubmit={handleJoin} className="mt-5 grid gap-3">
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              required
              maxLength={20}
              className="h-14 rounded-2xl border border-line-strong bg-bg-surface px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
              placeholder={t("nickname")}
            />
            <button className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]">
              {t("roomga_kirish")}
            </button>
          </form>
          {error ? (
            <p className="mt-3 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              {error}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  // ─── LOBBY VIEW ──────────────────────────────────────────────
  if (room.status === "LOBBY") {
    return (
      <main className="min-h-screen bg-bg-base text-ink-primary">
        {connectionFeedback}
        <div className="mx-auto max-w-xl px-5 pt-safe pb-32">
          <header className="flex items-center justify-between py-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="-ml-2 flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm text-ink-secondary"
            >
              <span aria-hidden>←</span> {t("bosh_sahifa")}
            </button>
            <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary">
              {t("lobby")}
            </span>
          </header>

          <section className="mt-2 rounded-3xl border border-line-subtle bg-bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("room_code")}
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em]">
              {room.code}
            </p>
            <p className="mt-2 text-sm text-ink-secondary">
              {t("players_maxplayers_oyinchi_finish_winnertarget_fefe", {
                players: players.length,
                maxPlayers: room.maxPlayers,
                winnerTarget: room.winnerTarget
              })}
            </p>

            {me.isHost && showLobbyShareActions ? (
              <div className="mt-4 grid gap-2">
                <LobbyShareActions
                  roomCode={room.code}
                  inviteUrl={inviteUrl}
                  gameLabel="Bunker"
                />
              </div>
            ) : null}

            {isOnlineVariant ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                  {t("tab_online")}
                </span>
                <span className="rounded-full border border-line-strong bg-bg-base px-3 py-1 text-xs font-medium text-ink-secondary">
                  {t(visibility === "PUBLIC" ? "tab_public" : "tab_private")}
                </span>
              </div>
            ) : null}
          </section>

          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t("oyinchilar")}</h2>
              <p className="text-xs text-ink-muted">
                {t("kamida_3_kishi_count_ta_fcb6", {
                  count: alivePlayers.length
                })}
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {players.map((p) => (
                <PlayerCard
                  key={p.id}
                  name={p.name}
                  isHost={p.isHost}
                  isAlive={p.isAlive}
                  online={p.online}
                  isReady={!!p.readyAt}
                  showPresence
                  revealedCards={{}}
                  isMe={p.id === me.id}
                  variant="tile"
                  onKick={
                    me.isHost && p.id !== me.id
                      ? () => setKickTarget({ id: p.id, name: p.name })
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>

          {isOnlineVariant ? (
            <>
              <p className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface p-4 text-center text-sm text-ink-secondary">
                {me.isHost
                  ? t("online_lobbida_hamma_tayyor_bolsa_7195")
                  : t("online_oyinda_barcha_tayy_9f6b")}
              </p>
              {!me.isHost ? (
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    disabled={players.length < 3}
                    onClick={() => emit("toggle_ready")}
                    className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 ${
                      meReady
                        ? "border border-brand/30 bg-brand-soft text-brand"
                        : "bg-brand text-bg-base"
                    }`}
                  >
                    {meReady ? t("tayyorni_bekor_qilish") : t("tayyorman")}
                  </button>
                  {players.length < 3 ? (
                    <p className="text-center text-xs text-ink-muted">
                      {t("count_ta_oyinchi_kerak", { count: 3 })}
                    </p>
                  ) : (
                    <p className="text-center text-xs text-ink-muted">
                      {t("kamida_3_kishi_count_ta_fcb6", {
                        count: readyCount
                      })}
                    </p>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  me.isHost ? setEndGameConfirmOpen(true) : setLeaveConfirmOpen(true)
                }
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad transition active:scale-[0.99]"
              >
                {t(me.isHost ? "roomni_ochirish" : "roomdan_chiqish")}
              </button>
            </>
          ) : !me.isHost ? (
            <>
              <p className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface p-4 text-center text-sm text-ink-secondary">
                {t("host_oyinni_boshlashini_kuting")}
              </p>
              <button
                type="button"
                onClick={() => setLeaveConfirmOpen(true)}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad transition active:scale-[0.99]"
              >
                {t("roomdan_chiqish")}
              </button>
            </>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              {error}
            </p>
          ) : null}
        </div>

        {me.isHost && !isOnlineVariant ? (
          <div className="fixed inset-x-0 bottom-0 border-t border-line-subtle bg-bg-base/95 px-5 pb-safe pt-3 backdrop-blur">
            <div className="mx-auto max-w-xl">
              <HostControls
                isHost={me.isHost}
                isLobby
                canStartGame={room.status === "LOBBY" && players.length >= 3}
                canStartRound={false}
                canStartReveals={false}
                canAdvanceTurn={false}
                canStartVoting={false}
                canSkipVoting={false}
                votingFinished={false}
                onStartGame={() => emit("start_game")}
                onStartRound={() => emit("start_round")}
                onStartReveals={() => emit("start_reveals")}
                onAdvanceTurn={() => emit("advance_turn")}
                onStartVoting={() => emit("start_voting")}
                onSkipVoting={() => emit("skip_voting")}
                onEndGame={() => setEndGameConfirmOpen(true)}
              />
            </div>
          </div>
        ) : null}

        <ConfirmModal
          open={endGameConfirmOpen}
          title="Roomni bekor qilasizmi?"
          description="Room bekor qilinadi va barcha ishtirokchilar bosh sahifaga qaytadi. Bu amalni bekor qilib bo‘lmaydi."
          confirmLabel="Ha, bekor qilish"
          cancelLabel="Yo‘q"
          tone="danger"
          onConfirm={() => {
            emit("end_game");
            setEndGameConfirmOpen(false);
            router.push("/dashboard");
          }}
          onClose={() => setEndGameConfirmOpen(false)}
        />
        <ConfirmModal
          open={leaveConfirmOpen}
          title={t("roomdan_chiqasizmi")}
          description={t("siz_xonadan_chiqasiz_va_oyin_a97d")}
          confirmLabel={t("ha_chiqish")}
          cancelLabel={t("bekor_qilish")}
          tone="danger"
          onConfirm={() => {
            isLeavingRef.current = true;
            emit("leave_room");
            setLeaveConfirmOpen(false);
            router.push("/dashboard");
          }}
          onClose={() => setLeaveConfirmOpen(false)}
        />
        <ConfirmModal
          open={!!kickTarget}
          title={
            kickTarget ? t("name_ni_oyindan_chiqarish", { name: kickTarget.name }) : ""
          }
          description={t("ushbu_oyinchining_barcha_kartalari_ochiladi_4162")}
          confirmLabel={t("chiqarish")}
          cancelLabel={t("bekor_qilish")}
          tone="danger"
          onConfirm={() => {
            if (kickTarget) {
              emit("kick_player", { targetPlayerId: kickTarget.id });
            }
            setKickTarget(null);
          }}
          onClose={() => setKickTarget(null)}
        />
      </main>
    );
  }

  // ─── GAME VIEW ───────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <TelegramChrome
        backHref="/dashboard"
        closingConfirmation={closingConfirmation}
      />
      {connectionFeedback}
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-line-subtle bg-bg-base/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 pt-safe pb-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              {t("round")}{" "}
              {room.status === "FINISHED"
                ? "—"
                : Math.max(room.round, 1)}{" "}
              · {room.code}
            </p>
            <p
              key={`${game.phase}-${game.currentTurnPlayerId ?? "_"}`}
              className="animate-fade-in truncate text-sm font-semibold text-ink-primary"
            >
              {game.phase === "ROUND_REVEAL" && !game.currentTurnPlayerId
                ? t("reveal_kutilmoqda")
                : votingFinished
                  ? t("eliminatsiya_tugadi")
                  : t(phaseHelp[game.phase])}
              {currentTurnPlayer
                ? ` · ${currentTurnPlayer.name}${
                    currentTurnPlayer.id === me.id ? ` ${t("siz")}` : ""
                  }`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Timer seconds={game.remainingSeconds} />
            <button
              onClick={toggleAudio}
              aria-label={audioEnabled ? t("ovozni_ochirish") : t("ovozni_yoqish")}
              className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-bg-surface text-ink-secondary"
            >
              {audioEnabled ? "🔊" : "🔇"}
            </button>
          </div>
        </div>
      </header>

      <div
        className="mx-auto max-w-xl px-4 pt-3"
        style={{
          paddingBottom:
            Math.max(
              bottomBarHeight,
              me.isHost && !isOnlineVariant ? 240 : 140
            ) + 24
        }}
      >
        {/* Disaster + situation summary */}
        {game.disaster || game.situation ? (
          <div
            key={`${game.roundNumber}-${game.situation?.id ?? "intro"}`}
            className="animate-fade-in rounded-2xl border border-line-subtle bg-bg-surface"
          >
            {game.disaster ? (
              <button
                type="button"
                onClick={() => setIntroOpen(true)}
                className="block w-full px-4 pt-3 pb-3 text-left transition active:opacity-80"
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
                  {t("fojea")}
                </p>
                <p className="mt-0.5 text-base font-semibold">{localizedDisasterName}</p>
              </button>
            ) : null}

            {game.disaster && game.situation ? (
              <div className="border-t border-line-subtle" />
            ) : null}

            {game.situation ? (
              <button
                type="button"
                onClick={() => setSituationOpen(true)}
                className="block w-full px-4 pt-3 pb-4 text-left transition active:opacity-80"
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-warn">
                  {t("round_roundnumber_vaziyati", {
                    roundNumber: game.roundNumber
                  })}
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-primary">{localizedSituationText}</p>
              </button>
            ) : null}
          </div>
        ) : null}

        {room.status === "FINISHED" ? (
          <section className="mt-4 rounded-2xl border border-ok/30 bg-ok/10 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-ok">
              {t("yakuniy_natija")}
            </p>
            <p className="mt-1 text-base font-semibold">
              {t("yutganlar_names", {
                names: winners.map((p) => p.name).join(", ") || t("hech_kim_qolmadi")
              })}
            </p>
          </section>
        ) : null}

        {/* Players */}
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-primary">
              {t("oyinchilar")}
            </h2>
            <p className="text-xs text-ink-muted">
              {t("tirik_alive_total", {
                alive: alivePlayers.length,
                total: players.length
              })}
            </p>
          </div>
          <ul className="grid gap-2">
            {displayPlayers.map((p) => (
              <PlayerCard
                key={p.id}
                name={p.name}
                isHost={p.isHost}
                isAlive={p.isAlive}
                isMe={p.id === me.id}
                revealedCards={p.visibleCards}
                isCurrentTurn={p.id === game.currentTurnPlayerId}
                gameOver={room.status === "FINISHED"}
                onKick={
                    me.isHost &&
                    !isOnlineVariant &&
                    room.status === "PLAYING" &&
                    p.isAlive &&
                    !p.isHost
                    ? () => setKickTarget({ id: p.id, name: p.name })
                    : undefined
                }
              />
            ))}
          </ul>
        </section>

        {error ? (
          <p className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>

      {/* Sticky bottom actions */}
      <div
        ref={setBottomBarNode}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-bg-base/95 backdrop-blur"
      >
        <div className="mx-auto max-w-xl px-4 pt-3 pb-safe">
          {me.isHost && room.status !== "FINISHED" && isOnlineVariant ? (
            <div className="mb-2 rounded-2xl border border-line-subtle bg-bg-surface p-3 shadow-pop">
              <p className="mb-2 text-xs font-medium text-ink-muted">
                {t("online_rejim_avtomatik_oqim_8c64")}
              </p>
              <button
                type="button"
                onClick={() => setEndGameConfirmOpen(true)}
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-bad/40 bg-bad/10 px-4 text-sm font-semibold text-bad transition active:scale-[0.98]"
              >
                {t("oyinni_tugatish")}
              </button>
            </div>
          ) : null}

          {me.isHost && room.status !== "FINISHED" && !isOnlineVariant ? (
            <div className="mb-2">
              <HostControls
                isHost={me.isHost}
                canStartGame={false}
                canStartRound={
                  room.status === "PLAYING" && game.phase === "INTRO"
                }
                canStartReveals={!!canStartRevealsHost}
                canAdvanceTurn={
                  room.status === "PLAYING" && game.phase === "ROUND_PITCH"
                }
                advanceTurnLabel={
                  hasMoreRevealPlayers ? "Keyingi o'yinchi" : "Pitchni yakunlash"
                }
                canStartVoting={
                  room.status === "PLAYING" && game.phase === "ROUND_COMPLETE"
                }
                canSkipVoting={
                  room.status === "PLAYING" && game.phase === "ROUND_COMPLETE"
                }
                votingFinished={votingFinished}
                onStartGame={() => emit("start_game")}
                onStartRound={() => emit("start_round")}
                onStartReveals={() => emit("start_reveals")}
                onAdvanceTurn={() => emit("advance_turn")}
                onStartVoting={() => emit("start_voting")}
                onSkipVoting={() => emit("skip_voting")}
                onEndGame={() => setEndGameConfirmOpen(true)}
              />
            </div>
          ) : null}

          {!me.isHost &&
          game.phase === "ROUND_PITCH" &&
          game.currentTurnPlayerId === me.id ? (
            <button
              type="button"
              onClick={() => emit("advance_turn")}
              className="mb-2 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("pitchni_tugatish")}
            </button>
          ) : null}

          {room.status === "FINISHED" ? (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-ok text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("bosh_sahifaga_qaytish")}
            </button>
          ) : (
            <button
              type="button"
              onClick={openMyCards}
              className="flex h-14 w-full items-center justify-between rounded-2xl border border-line-strong bg-bg-surface px-4 text-left transition active:scale-[0.99]"
            >
              <div>
                <p className="text-xs text-ink-muted">{t("mening_kartalarim")}</p>
                <p className="text-sm font-semibold">
                  {t("count_6_ochilgan", { count: myRevealedCount })}
                  {!me.isAlive ? ` · ${t("chiqqansiz")}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                {t("korish")}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* My cards bottom sheet */}
      {myCardsOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-50 flex flex-col justify-end bg-bg-overlay backdrop-blur-sm ${
            myCardsClosing ? "animate-overlay-out" : "animate-overlay-in"
          }`}
        >
          <div className="absolute inset-0" onClick={closeMyCards} />
          <div
            className={`relative z-10 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-line-subtle bg-bg-surface px-5 pt-4 pb-safe ${
              myCardsClosing ? "animate-sheet-out" : "animate-sheet-in"
            }`}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-brand">
                  {t("mening_kartalarim")}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold">
                  {t("count_6_ochilgan", { count: myRevealedCount })}
                </h2>
              </div>
              <button
                onClick={closeMyCards}
                className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-bg-elevated"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {myCards.map((card) => (
                <div
                  key={card.type}
                  className={`rounded-2xl border p-3 ${
                    card.isRevealed
                      ? "border-brand/30 bg-brand-soft"
                      : "border-line-subtle bg-bg-base"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                      {card.label}
                    </p>
                    {card.isRevealed ? (
                      <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-semibold text-brand">
                        {t("ochiq")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                        {t("yashirin")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-ink-primary">{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Disaster intro overlay */}
      {introOpen && game.disaster ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-end justify-center bg-bg-overlay backdrop-blur-sm sm:items-center"
        >
          <div className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border-t border-line-subtle bg-bg-surface pb-safe shadow-pop sm:rounded-3xl sm:border">
            <div className="mx-auto mt-3 mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            {disasterImage[game.disaster.name.uz] ? (
              // Banner image — sits flush to the modal edges so the
              // imagery feels cinematic. Bottom gradient ensures the
              // "Fojea" pill stays legible against bright artwork.
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <Image
                  src={disasterImage[game.disaster.name.uz]}
                  alt={localizedDisasterName}
                  fill
                  sizes="(max-width: 640px) 100vw, 448px"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-surface via-bg-surface/40 to-transparent" />
              </div>
            ) : null}
            <div className="px-5 pb-5 pt-1">
              <p className="text-xs font-medium uppercase tracking-wider text-brand">
                {t("fojea")}
              </p>
              <h2 className="mt-1 text-2xl font-bold">{localizedDisasterName}</h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">{localizedDisasterDescription}</p>
              <div className="mt-5 grid gap-2">
                <button
                  onClick={() => setIntroOpen(false)}
                  className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
                >
                  {t("tushundim")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Situation overlay */}
      {situationOpen && game.situation ? (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-40 flex items-end justify-center bg-bg-overlay backdrop-blur-sm sm:items-center ${
            situationClosing ? "animate-overlay-out" : "animate-overlay-in"
          }`}
        >
          <div className="absolute inset-0" />
          <div className={`relative z-10 w-full max-w-md rounded-t-3xl border-t border-line-subtle bg-bg-surface p-5 pb-safe shadow-pop sm:rounded-3xl sm:border ${
            situationClosing ? "animate-sheet-out" : "animate-sheet-in"
          }`}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            <p className="text-xs font-medium uppercase tracking-wider text-warn">
              {t("round_roundnumber_vaziyati", {
                roundNumber: game.roundNumber
              })}
            </p>
            <p className="mt-3 text-base leading-7 text-ink-primary">{localizedSituationText}</p>
            <button
              onClick={closeSituation}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("roundga_kirish")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Reveal overlay */}
      {shouldShowRevealOverlay ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-end justify-center bg-bg-overlay backdrop-blur-sm sm:items-center"
        >
          <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line-subtle bg-bg-surface px-5 pt-4 pb-safe shadow-pop sm:rounded-3xl sm:border">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("sizning_navbatingiz")}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{t("bitta_kartani_tanlang")}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              {t("tanlaganingizdan_keyin_2_daqiqada_nega_18e0")}
            </p>
            <div className="mt-4 grid gap-2">
              {revealOptions.map((card) => (
                <button
                  key={card.type}
                  onClick={() => emit("reveal_card", { cardType: card.type })}
                  className="rounded-2xl border border-line-subtle bg-bg-base p-4 text-left transition active:scale-[0.99]"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    {card.label}
                  </p>
                  <p className="mt-1 text-base text-ink-primary">{card.value}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Voting — only shown to alive players */}
      {game.phase === "VOTING" && me.isAlive ? (
        <VotePanel
          canVote={canVote}
          hasVoted={roomState.votes.submittedByMe}
          players={localizedPlayers.map((p) => ({
            id: p.id,
            name: p.name,
            isAlive: p.isAlive,
            visibleCards: p.visibleCards
          }))}
          meId={me.id}
          tiebreakCandidateIds={game.tiebreakCandidateIds}
          secondsLeft={game.remainingSeconds}
          onVote={(targetPlayerId) => {
            tgHaptic("rigid");
            emit("vote", { targetPlayerId });
          }}
        />
      ) : null}

      {/* Self-elimination modal */}
      {eliminatedModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg-overlay backdrop-blur-md sm:items-center"
        >
          <div className="absolute inset-0" />
          <div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border-t border-bad/40 bg-bg-surface pb-safe shadow-pop sm:rounded-3xl sm:border"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 0%, rgba(239,68,68,0.22), transparent 55%), linear-gradient(180deg, rgba(239,68,68,0.04) 0%, rgba(11,13,18,0) 60%)"
            }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

            <div className="px-6 pt-6 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-bad/30 bg-bad/10">
                <svg
                  width="38"
                  height="38"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-bad"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-bad">
                {t("eliminatsiya")}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-ink-primary">
                {t("siz_bunkerdan_chiqarildingiz")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                {t("sizning_kartalaringiz_endi_hammaga_ochiq_44da")}
              </p>
            </div>

            <div className="px-5 pt-5 pb-5">
              <button
                onClick={() => setEliminatedModalOpen(false)}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-bad text-base font-semibold text-white transition active:scale-[0.98]"
              >
                {t("kuzatishda_davom_etish")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Winner modal — suppressed while the self-elimination modal is
          open, so a final-round cut shows "Siz bunkerdan chiqarildingiz"
          first and only reveals "O'yin tugadi" after the player
          acknowledges. Once `eliminatedModalOpen` flips to false, this
          condition flips to true on the next render. */}
      {winnerModalOpen && !eliminatedModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg-overlay backdrop-blur-md sm:items-center"
        >
          <div className="absolute inset-0" />
          <div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border-t border-brand/40 bg-bg-surface pb-safe shadow-pop sm:rounded-3xl sm:border"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 0%, rgba(244,168,58,0.28), transparent 55%), linear-gradient(180deg, rgba(34,197,94,0.06) 0%, rgba(11,13,18,0) 70%)"
            }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

            <div className="px-6 pt-6 text-center">
              <div
                className={`mx-auto grid h-20 w-20 place-items-center rounded-full border ${me.isAlive ? "border-brand/40 bg-brand/15" : "border-bad/40 bg-bad/15"}`}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={me.isAlive ? "text-brand" : "text-bad"}
                  aria-hidden
                >
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                  <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
                  <path d="M17 4h3v3a3 3 0 0 1-3 3" />
                  <path d="M7 4H4v3a3 3 0 0 0 3 3" />
                </svg>
              </div>
              <p
                className={`mt-4 text-xs font-medium uppercase tracking-[0.25em] ${me.isAlive ? "text-brand" : "text-bad"}`}
              >
                {me.isAlive ? t("galaba") : t("oyin_tugadi")}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-ink-primary">
                {me.isAlive
                  ? t("siz_bunkerda_omon_qoldingiz")
                  : t("bu_safar_omad_yor_bolmadi")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                {me.isAlive
                  ? t("tabriklaymiz_insoniyatning_kelajagini_siz_tiklaysiz")
                  : t("siz_oyindan_chiqib_ketgansiz_lekin_f036")}
                {winners.length > 0
                  ? ` ${t("bunkerda_qolganlar")} ${winners
                      .map((w) => w.name)
                      .join(", ")}.`
                  : ` ${t("bunkerda_hech_kim_qolmadi")}`}
              </p>
            </div>

            <div className="grid gap-2 px-5 pt-5 pb-5">
              <button
                onClick={() => setWinnerModalOpen(false)}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
              >
                {t("natijani_korish")}
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-elevated text-sm font-semibold text-ink-primary"
              >
                {t("bosh_sahifa")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={endGameConfirmOpen}
        title={t("oyinni_tugatmoqchimisiz")}
        description={t("oyin_shu_zahoti_yakunlanadi_va_f15f")}
        confirmLabel={t("ha_tugatish")}
        cancelLabel={t("yoq")}
        tone="danger"
        onConfirm={() => {
          emit("end_game");
          setEndGameConfirmOpen(false);
        }}
        onClose={() => setEndGameConfirmOpen(false)}
      />

      <ConfirmModal
        open={!!kickTarget}
        title={
          kickTarget ? t("name_ni_oyindan_chiqarish", { name: kickTarget.name }) : ""
        }
        description={t("ushbu_oyinchining_barcha_kartalari_ochiladi_4162")}
        confirmLabel={t("chiqarish")}
        cancelLabel={t("bekor_qilish")}
        tone="danger"
        onConfirm={() => {
          if (kickTarget) {
            emit("kick_player", { targetPlayerId: kickTarget.id });
          }
          setKickTarget(null);
        }}
        onClose={() => setKickTarget(null)}
      />

      <ConfirmModal
        open={leaveConfirmOpen}
        title={t("roomdan_chiqasizmi")}
        description={t("siz_xonadan_chiqasiz_va_oyin_a97d")}
        confirmLabel={t("ha_chiqish")}
        cancelLabel={t("bekor_qilish")}
        tone="danger"
        onConfirm={() => {
          isLeavingRef.current = true;
          emit("leave_room");
          setLeaveConfirmOpen(false);
          router.push("/dashboard");
        }}
        onClose={() => setLeaveConfirmOpen(false)}
      />

      {/* Lobby cancellation modal — host tugatdi, o'yin umuman bo'lmadi.
          Shared with Mafia via the CancelledRoomModal component. */}
      <CancelledRoomModal
        open={cancelledModalOpen}
        onDismiss={() => {
          setCancelledModalOpen(false);
          router.push("/dashboard");
        }}
      />

      {/* Floating announcement */}
      {announcement ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-safe">
          <div className="mt-3 w-full max-w-md rounded-2xl border border-line-strong bg-bg-elevated px-4 py-3 shadow-pop">
            <p className="text-sm font-semibold text-ink-primary">
              {announcement.title}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              {announcement.description}
            </p>
          </div>
        </div>
      ) : null}

      {/* Card reveal modal — shows whose card just opened, with the new
          card highlighted and older reveals as smaller chips. */}
      {revealModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-3xl border border-line-strong bg-bg-surface p-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
              {t("karta_ochildi")}
            </p>
            <h3 className="mt-1 text-xl font-bold text-ink-primary">
              {revealModal.playerName}
            </h3>

            <div
              className="mt-5"
              style={{ perspective: 1200 }}
              key={`${revealModal.playerId}-${revealModal.newCardType}`}
            >
              <div
                className="animate-card-flip relative grid"
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Back of the card — visible during the first ~120ms
                    while the flip animation is delayed. */}
                <div
                  className="col-start-1 row-start-1 grid place-items-center rounded-2xl border border-line-strong bg-bg-elevated p-4"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)"
                  } as React.CSSProperties}
                >
                  <span className="text-4xl font-bold text-ink-muted">?</span>
                </div>
                {/* Front — the actual revealed value. Same grid cell, so
                    both faces share dimensions. */}
                <div
                  className="col-start-1 row-start-1 rounded-2xl border border-brand/40 bg-brand-soft/40 p-4"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden"
                  } as React.CSSProperties}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
                    {t("label_yangi", {
                      label: t(cardLabels[revealModal.newCardType])
                    })}
                  </p>
                  <p className="mt-2 text-base font-semibold leading-7 text-ink-primary">
                    {revealModal.newCardValue}
                  </p>
                </div>
              </div>
            </div>

            {revealModal.olderCards.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                  {t("avval_ochilganlar")}
                </p>
                <ul className="mt-2 grid gap-2">
                  {revealModal.olderCards.map((c) => (
                    <li
                      key={c.type}
                      className="rounded-xl border border-line-subtle bg-bg-base/60 px-3 py-2"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                        {t(cardLabels[c.type])}
                      </p>
                      <p className="mt-0.5 text-sm leading-6 text-ink-secondary">
                        {c.value}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setRevealModal(null)}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("tushundim")}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
