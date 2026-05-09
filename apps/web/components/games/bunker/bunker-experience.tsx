"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CancelledRoomModal } from "@/components/cancelled-room-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { LoadingState } from "@/components/loading-state";
import { RoomExpiredState } from "@/components/room-expired-state";
import { TelegramChrome } from "@/components/telegram-chrome";
import { useI18n } from "@/lib/i18n";
import {
  getLocalizedText,
  type LocalizedText,
  type SupportedLanguage,
} from "@/lib/localized-content";
import { HostControls } from "./bunker-host-controls";
import { PlayerCard } from "./bunker-player-card";
import { Timer } from "@/components/timer";
import { getAuthToken, getAuthUser } from "@/lib/auth";
import { tgHaptic, tgHapticNotify } from "@/lib/telegram";
import { VotePanel } from "./bunker-vote-panel";
import { useGameAudio } from "./use-bunker-audio";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { getOrCreateSessionId } from "@/lib/storage";
import type {
  BunkerCardType,
  BunkerPhase,
  BunkerRoomState,
} from "./bunker-types";
import { useGameStore } from "./use-bunker-store";
import { pushToast } from "@/store/useToastStore";
import {
  RealtimeConnectionFeedback,
  useRealtimeConnectionRecovery,
} from "../shared/realtime-connection-feedback";
import { OnlineChat } from "../shared/online-chat";
import { OnlineGovernanceModal } from "../shared/online-governance-modal";
import { RoomLeaveButton } from "../shared/room-leave-button";
import {
  JoinWithNicknameRoomState,
  KickedFromRoomState,
  LoginPromptRoomState,
  UnavailableRoomState,
} from "../shared/game-entry-states";
import type { RoomVisibility } from "@/lib/types";
import { BunkerLobby } from "./bunker-lobby";
import {
  BunkerCardRevealModal,
  BunkerDisasterIntroModal,
  BunkerEliminationModal,
  BunkerMyCardsSheet,
  BunkerRevealChoiceModal,
  BunkerSituationModal,
  BunkerWinnerModal,
} from "./bunker-overlays";

const BUNKER_ONLINE_MODAL_TIMINGS_MS = {
  intro: 12000,
  situation: 9000,
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
  "Narkotik urushi": "/bunker/adult/narkotik-banner.webp",
};

const cardLabels: Record<BunkerCardType, string> = {
  PROFESSION: "Kasb",
  HEALTH: "Sog‘liq",
  CHARACTER: "Xarakter",
  SKILL: "Ko‘nikma",
  BAGGAGE: "Bagaj",
  FACT: "Fakt",
};

const cardOrder: BunkerCardType[] = [
  "PROFESSION",
  "HEALTH",
  "CHARACTER",
  "SKILL",
  "BAGGAGE",
  "FACT",
];

const phaseHelp: Record<BunkerPhase, string> = {
  LOBBY: "Lobby — kuting",
  INTRO: "Tanishuv",
  ROUND_REVEAL: "Karta ochish navbati",
  ROUND_PITCH: "Pitch — 2 daqiqa",
  ROUND_COMPLETE: "Round yakuni",
  VOTING: "Ovoz berish",
  FINISHED: "Yakun",
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
  language: SupportedLanguage,
): Partial<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(cards).map(([key, value]) => [
      key,
      getLocalizedText(value, language),
    ]),
  );
}

export function BunkerExperience({
  roomCode,
  view,
  uiVariant = "friends",
  visibility = "PRIVATE",
}: BunkerExperienceProps) {
  const router = useRouter();
  const { language, t } = useI18n();
  const isOnlineVariant = uiVariant === "online";
  // Public matchmaking rooms have no host concept from the player's
  // perspective — the system manages timers and phase changes, the
  // creator is just another participant. Hide all host-only badges,
  // styling, and "you created this room" affordances. Friends and
  // private-online rooms keep their normal host UI.
  const hideHostUi = isOnlineVariant && visibility === "PUBLIC";
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
  const [dismissedKickProposalId, setDismissedKickProposalId] = useState<
    string | null
  >(null);
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
      Omit<
        BunkerRoomState["players"][number],
        "visibleCards" | "revealedCards"
      > & {
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
      `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
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

  // Init session
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
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
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
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
    setRoomState,
  ]);

  // Local 1Hz tick driven by the authoritative `timerEndsAt`. The server
  // also broadcasts `timer_update` once per second, but a single dropped
  // packet (or a Telegram WebApp tab that just resumed from background)
  // would otherwise leave the visible timer frozen until the phase
  // resolves. Computing locally from the deadline keeps the countdown
  // smooth, and any server broadcast that arrives still overrides via
  // patchTimer above.
  const timerEndsAtIso = roomState?.game.timerEndsAt ?? null;
  useEffect(() => {
    if (!timerEndsAtIso) return;
    const endsAt = new Date(timerEndsAtIso).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      patchTimer(remaining);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timerEndsAtIso, patchTimer]);

  // Auto-route based on status
  useEffect(() => {
    if (!roomState) return;
    if (roomState.room.status === "CANCELLED") {
      setCancelledModalOpen(true);
    }
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
    roomState?.room.status,
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
      revealedCards: localizeCardMap(player.revealedCards, language),
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

    const olderCards: Array<{ type: BunkerCardType; value: string }> =
      Object.entries(player.revealedCards ?? {})
        .filter(([t, v]) => t !== cardType && !!v)
        .map(([t, v]) => ({ type: t as BunkerCardType, value: v as string }));

    seenRevealAnnouncementRef.current.add(key);
    tgHaptic("light");
    setRevealModal({
      playerId,
      playerName: player.name,
      newCardType: cardType,
      newCardValue,
      olderCards,
    });
  }, [
    roomState?.game.lastRevealedCardType,
    roomState?.game.lastRevealedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me?.id,
  ]);

  // Elimination announcement — only re-fires when the actual elimination changes.
  useEffect(() => {
    if (!roomState?.game.lastEliminatedPlayerId) return;
    const key = `eliminated-${roomState.game.roundNumber}-${roomState.game.lastEliminatedPlayerId}`;
    if (seenElimAnnouncementRef.current.has(key)) return;

    const player = playersRef.current.find(
      (p) => p.id === roomState.game.lastEliminatedPlayerId,
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
        "Bu o'yinchi endi ovoz bera olmaydi, lekin kuzatishda davom etadi.",
      ),
    });
  }, [
    t,
    roomState?.game.lastEliminatedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me?.id,
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
    roomState?.me?.id,
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
  }, [roomState?.room.status, roomState?.room.code, roomState?.me?.id]);

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
    router,
    roomState?.room.status,
    roomState?.room.code,
    roomState?.me?.id,
    roomState?.me?.isHost,
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
    roomState?.me,
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
    roomState?.me,
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
    meEliminationKey,
  });

  // Helpers
  async function joinWithName(name: string) {
    await apiRequest(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      body: JSON.stringify({ name, sessionId }),
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

  const { browserOnline, showRecoveryModal, retryNow, reloadPage } =
    useRealtimeConnectionRecovery({
      enabled: !!sessionId,
      connected: socketConnected,
      onReconnect: reconnectSocket,
      onRefreshState: refreshState,
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
  const closingConfirmation =
    !!room && room.status !== "FINISHED" && room.status !== "CANCELLED";
  const players = roomState?.players ?? [];
  const meReady =
    !!me && players.some((player) => player.id === me.id && !!player.readyAt);
  const localizedPlayers = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        visibleCards: localizeCardMap(player.visibleCards, language),
        revealedCards: localizeCardMap(player.revealedCards, language),
      })),
    [language, players],
  );
  const alivePlayers = players.filter((p) => p.isAlive);
  const currentTurnPlayer = players.find(
    (p) => p.id === game?.currentTurnPlayerId,
  );
  const activeGovernanceProposal =
    roomState?.governance.kickProposal?.id === dismissedKickProposalId
      ? null
      : (roomState?.governance.kickProposal ?? null);
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
      isRevealed: me.revealed.includes(type),
    }));
  }, [language, me, t]);
  const myVisibleCards = useMemo(
    () =>
      Object.fromEntries(
        myCards
          .filter((card) => card.isRevealed)
          .map((card) => [card.type, card.value]),
      ) as Partial<Record<BunkerCardType, string>>,
    [myCards],
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
        visibleCards: isFinished ? selfPlayer.visibleCards : myVisibleCards,
      },
      ...others,
    ];
  }, [isFinished, localizedPlayers, me, myVisibleCards]);

  const revealOptions = useMemo(
    () =>
      myCards.filter(
        (c) => c.type !== "PROFESSION" && !me?.revealed.includes(c.type),
      ),
    [me?.revealed, myCards],
  );
  const revealModalContent = useMemo(() => {
    if (!revealModal) return null;
    return {
      animationKey: `${revealModal.playerId}-${revealModal.newCardType}`,
      playerName: revealModal.playerName,
      cardLabel: t(cardLabels[revealModal.newCardType]),
      newCardValue: revealModal.newCardValue,
      olderCards: revealModal.olderCards.map((card) => ({
        type: card.type,
        label: t(cardLabels[card.type]),
        value: card.value,
      })),
    };
  }, [revealModal, t]);

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
      p.revealedCount < roundRevealTarget,
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
        <main>
          <TelegramChrome backHref="/dashboard" />
          <LoadingState label={t("room_yuklanmoqda")} />
        </main>
      );
    }
    return <RoomExpiredState roomCode={roomCode} detail={error} />;
  }

  if (!me) {
    if (kickedModalOpen) {
      return (
        <KickedFromRoomState onGoHome={() => router.push("/dashboard")} />
      );
    }

    if (room.status !== "LOBBY") {
      const finished =
        room.status === "FINISHED" || room.status === "CANCELLED";
      return (
        <UnavailableRoomState
          roomCode={roomCode}
          finished={finished}
          startedDescriptionKey="oyin_boshlanganidan_keyin_yangi_oyinchi_7a2b"
          onGoHome={() => router.push("/dashboard")}
        />
      );
    }

    if (!getAuthToken()) {
      const loginHref = `/login?redirect=${encodeURIComponent(`/room/${roomCode}`)}`;
      return (
        <LoginPromptRoomState
          roomCode={roomCode}
          pretitleKey="taklif"
          loginHref={loginHref}
        />
      );
    }

    return (
      <JoinWithNicknameRoomState
        roomCode={roomCode}
        pretitleKey="taklif"
        joinName={joinName}
        error={error}
        onJoinNameChange={setJoinName}
        onSubmit={handleJoin}
      />
    );
  }

  if (room.status === "CANCELLED") {
    return (
      <main className="min-h-screen bg-bg-base">
        <TelegramChrome backHref="/dashboard" />
        <div className="flex min-h-screen items-center justify-center">
          {/* Empty background while the modal is shown */}
        </div>
        <CancelledRoomModal
          open={cancelledModalOpen}
          onDismiss={() => {
            if (typeof window !== "undefined") {
              window.location.replace("/dashboard");
              return;
            }
            router.replace("/dashboard" as Route);
          }}
        />
        {connectionFeedback}
      </main>
    );
  }

  // ─── LOBBY VIEW ──────────────────────────────────────────────
  if (room.status === "LOBBY") {
    return (
      <>
        <BunkerLobby
          room={room}
          players={players}
          me={me}
          roomState={roomState}
          visibility={visibility}
          uiVariant={uiVariant}
          meReady={meReady}
          alivePlayersCount={alivePlayers.length}
          connectionFeedback={connectionFeedback}
          error={error}
          onLeaveRoom={() => setLeaveConfirmOpen(true)}
          onSendChat={(text) => emit("chat:send", { text })}
          onToggleReady={() => emit("toggle_ready")}
          onRequestKickPlayer={(player) => setKickTarget(player)}
        />
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
            kickTarget
              ? t("name_ni_oyindan_chiqarish", { name: kickTarget.name })
              : ""
          }
          description={
            isOnlineVariant
              ? t("name_ni_oyindan_chiqarishga_rozi_bolasizmi", {
                  name: kickTarget?.name ?? t("oyinchi_2"),
                })
              : t("ushbu_oyinchining_barcha_kartalari_ochiladi_4162")
          }
          confirmLabel={
            isOnlineVariant ? t("kick_uchun_ovoz_boshlash") : t("chiqarish")
          }
          cancelLabel={t("bekor_qilish")}
          tone="danger"
          onConfirm={() => {
            if (kickTarget) {
              emit(
                isOnlineVariant ? "online:request_kick_vote" : "kick_player",
                { targetPlayerId: kickTarget.id },
              );
            }
            setKickTarget(null);
          }}
          onClose={() => setKickTarget(null)}
        />
        <OnlineGovernanceModal
          proposal={activeGovernanceProposal}
          mePlayerId={me.id}
          onClose={() =>
            setDismissedKickProposalId(activeGovernanceProposal?.id ?? null)
          }
          onApprove={(proposalId) => {
            setDismissedKickProposalId(proposalId);
            emit("online:vote_kick", { proposalId, approve: true });
          }}
          onReject={(proposalId) => {
            setDismissedKickProposalId(proposalId);
            emit("online:vote_kick", { proposalId, approve: false });
          }}
        />
      </>
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
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 pt-safe pb-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              {t("round")}{" "}
              {room.status === "FINISHED" ? "—" : Math.max(room.round, 1)} ·{" "}
              {room.code}
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
              aria-label={
                audioEnabled ? t("ovozni_ochirish") : t("ovozni_yoqish")
              }
              className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-bg-surface text-ink-secondary"
            >
              {audioEnabled ? "🔊" : "🔇"}
            </button>
            {room.status !== "FINISHED" && (isOnlineVariant || !me.isHost) ? (
              <RoomLeaveButton onClick={() => setLeaveConfirmOpen(true)} />
            ) : null}
          </div>
        </div>
      </header>

      <div
        className="mx-auto max-w-2xl px-4 pt-3"
        style={{
          paddingBottom:
            Math.max(
              bottomBarHeight,
              me.isHost && !isOnlineVariant ? 240 : 140,
            ) + 24,
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
                <p className="mt-0.5 text-base font-semibold">
                  {localizedDisasterName}
                </p>
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
                    roundNumber: game.roundNumber,
                  })}
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-primary">
                  {localizedSituationText}
                </p>
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
                names:
                  winners.map((p) => p.name).join(", ") ||
                  t("hech_kim_qolmadi"),
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
                total: players.length,
              })}
            </p>
          </div>
          <ul className="grid gap-2">
            {displayPlayers.map((p) => (
              <PlayerCard
                key={p.id}
                name={p.name}
                isHost={hideHostUi ? false : p.isHost}
                isAlive={p.isAlive}
                isMe={p.id === me.id}
                revealedCards={p.visibleCards}
                isCurrentTurn={p.id === game.currentTurnPlayerId}
                gameOver={room.status === "FINISHED"}
                onReport={
                  isOnlineVariant &&
                  room.status === "PLAYING" &&
                  p.id !== me.id &&
                  p.isAlive
                    ? () => setKickTarget({ id: p.id, name: p.name })
                    : undefined
                }
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
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-safe">
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
                  hasMoreRevealPlayers
                    ? "Keyingi o'yinchi"
                    : "Pitchni yakunlash"
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

          {/* In online mode, the host plays as a regular player too — when
              it's their pitch turn they need the same "finish pitch" affordance
              as everyone else. The friends-mode host has the dedicated host
              control panel above and never reaches a turn of their own. */}
          {game.phase === "ROUND_PITCH" &&
          game.currentTurnPlayerId === me.id &&
          (!me.isHost || isOnlineVariant) ? (
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
            <div
              className={`grid gap-2 ${isOnlineVariant ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {isOnlineVariant ? (
                <OnlineChat
                  meId={me.id}
                  messages={roomState.chat.messages}
                  onSend={(text) => emit("chat:send", { text })}
                  floating={false}
                  highlightedPlayerId={
                    game.phase === "ROUND_PITCH"
                      ? game.currentTurnPlayerId
                      : null
                  }
                  triggerClassName="h-14"
                  // Collapse the chat sheet whenever the phase or the
                  // active speaker changes — the user needs to see the
                  // new state (vote opens, elimination revealed, next
                  // pitch starts) instead of staring at chat in the
                  // background.
                  closeOnSignal={`${game.phase}:${game.currentTurnPlayerId ?? ""}:${game.roundNumber}`}
                />
              ) : null}
              {/* Compact in the bottom action grid — the chat trigger sits
                  next to it on mobile and we need both labels to fit at 360px
                  without truncation. Single-row layout, no badge. */}
              <button
                type="button"
                onClick={openMyCards}
                className="flex h-14 w-full items-center justify-between gap-3 rounded-2xl border border-line-strong bg-bg-surface px-4 text-left transition active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {t("kartalarim")}
                  {!me.isAlive ? ` · ${t("chiqqansiz")}` : ""}
                </span>
                <span className="shrink-0 rounded-full bg-bg-base px-2.5 py-1 text-xs font-semibold text-ink-secondary">
                  {myRevealedCount}/6
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <BunkerMyCardsSheet
        open={myCardsOpen}
        closing={myCardsClosing}
        revealedCount={myRevealedCount}
        cards={myCards}
        onClose={closeMyCards}
      />

      <BunkerDisasterIntroModal
        open={introOpen && !!game.disaster}
        imageSrc={game.disaster ? disasterImage[game.disaster.name.uz] : undefined}
        title={localizedDisasterName}
        description={localizedDisasterDescription}
        onClose={() => setIntroOpen(false)}
      />

      <BunkerSituationModal
        open={situationOpen && !!game.situation}
        closing={situationClosing}
        roundNumber={game.roundNumber}
        text={localizedSituationText}
        onClose={closeSituation}
      />

      {/* Reveal overlay */}
      <BunkerRevealChoiceModal
        open={shouldShowRevealOverlay}
        seconds={game.remainingSeconds}
        options={revealOptions}
        onReveal={(cardType) => emit("reveal_card", { cardType })}
      />

      {/* Voting — only shown to alive players */}
      {game.phase === "VOTING" && me.isAlive ? (
        <VotePanel
          canVote={canVote}
          hasVoted={roomState.votes.submittedByMe}
          players={localizedPlayers.map((p) => ({
            id: p.id,
            name: p.name,
            isAlive: p.isAlive,
            visibleCards: p.visibleCards,
          }))}
          meId={me.id}
          tiebreakCandidateIds={game.tiebreakCandidateIds}
          secondsLeft={game.remainingSeconds}
          elimsThisRound={roomState.votes.elimsThisRound}
          onVote={(targetPlayerIds) => {
            tgHaptic("rigid");
            emit("vote", { targetPlayerIds });
          }}
        />
      ) : null}

      <BunkerEliminationModal
        open={eliminatedModalOpen}
        onClose={() => setEliminatedModalOpen(false)}
      />

      <BunkerWinnerModal
        open={winnerModalOpen && !eliminatedModalOpen}
        isAlive={me.isAlive}
        winnerNames={winners.map((winner) => winner.name)}
        onClose={() => setWinnerModalOpen(false)}
        onGoHome={() => router.push("/dashboard")}
      />

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
          kickTarget
            ? t(
                isOnlineVariant
                  ? "name_ni_chiqarish_2"
                  : "name_ni_oyindan_chiqarish",
                { name: kickTarget.name },
              )
            : ""
        }
        description={
          isOnlineVariant
            ? t("name_ni_oyindan_chiqarishga_rozi_bolasizmi", {
                name: kickTarget?.name ?? t("oyinchi_2"),
              })
            : t("ushbu_oyinchining_barcha_kartalari_ochiladi_4162")
        }
        confirmLabel={
          isOnlineVariant ? t("kick_uchun_ovoz_boshlash") : t("chiqarish")
        }
        cancelLabel={t("bekor_qilish")}
        tone="danger"
        onConfirm={() => {
          if (kickTarget) {
            emit(
              isOnlineVariant ? "online:request_kick_vote" : "kick_player",
              { targetPlayerId: kickTarget.id },
            );
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
      <OnlineGovernanceModal
        proposal={activeGovernanceProposal}
        mePlayerId={me.id}
        onClose={() =>
          setDismissedKickProposalId(activeGovernanceProposal?.id ?? null)
        }
        onApprove={(proposalId) => {
          setDismissedKickProposalId(proposalId);
          emit("online:vote_kick", { proposalId, approve: true });
        }}
        onReject={(proposalId) => {
          setDismissedKickProposalId(proposalId);
          emit("online:vote_kick", { proposalId, approve: false });
        }}
      />

      {/* Lobby cancellation modal — host tugatdi, o'yin umuman bo'lmadi.
          Shared with Mafia via the CancelledRoomModal component. */}
      <CancelledRoomModal
        open={cancelledModalOpen}
        onDismiss={() => {
          if (typeof window !== "undefined") {
            window.location.replace("/dashboard");
            return;
          }
          router.replace("/dashboard" as Route);
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

      <BunkerCardRevealModal
        open={!!revealModalContent}
        animationKey={revealModalContent?.animationKey ?? ""}
        playerName={revealModalContent?.playerName ?? ""}
        cardLabel={revealModalContent?.cardLabel ?? ""}
        newCardValue={revealModalContent?.newCardValue ?? ""}
        olderCards={revealModalContent?.olderCards ?? []}
        onClose={() => setRevealModal(null)}
      />
    </main>
  );
}
