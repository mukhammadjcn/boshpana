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

import { ConfirmModal } from "@/components/confirm-modal";
import { HostControls } from "./bunker-host-controls";
import { PlayerCard } from "./bunker-player-card";
import { Timer } from "@/components/timer";
import { getAuthToken, getAuthUser } from "@/lib/auth";
import {
  buildTelegramShareUrl,
  buildTelegramStartappLink,
  isInsideTelegram,
  openTelegramLink,
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

// Disaster banner mapping. Image filenames in /public are tied to the
// seeded disaster names — keep this in sync with data.md when new
// disasters are added. A missing entry simply falls back to the
// text-only modal layout.
const disasterImage: Record<string, string> = {
  "Yadro urushi": "/yaderdavri.webp",
  "Global virus": "/epidemiyadavri.webp",
  "AI isyoni": "/aidavri.webp",
  "Muz davri": "/muzlikdavri.webp",
  "Issiq apokalipsis": "/issiqdavri.webp",
  "Zombi apokalipsisi": "/zombidavri.webp"
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
};

type Announcement = {
  key: string;
  title: string;
  description: string;
};

export function BunkerExperience({ roomCode, view }: BunkerExperienceProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [joinName, setJoinName] = useState("");
  // Initialize loading=false if zustand store already has fresh state for this
  // room. This bridges the unavoidable remount when status changes flip the
  // route between /room/CODE and /game/CODE — without it, every transition
  // flashes the "Room yuklanmoqda…" screen.
  const [loading, setLoading] = useState(() => {
    const cached = useGameStore.getState().roomState;
    return !cached || cached.room.code !== roomCode.toUpperCase();
  });
  const [origin, setOrigin] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [socketConnected, setSocketConnected] = useState(true);
  const [introOpen, setIntroOpen] = useState(false);
  const [situationOpen, setSituationOpen] = useState(false);
  const [myCardsOpen, setMyCardsOpen] = useState(false);
  const [eliminatedModalOpen, setEliminatedModalOpen] = useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [cancelledModalOpen, setCancelledModalOpen] = useState(false);
  const [endGameConfirmOpen, setEndGameConfirmOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [kickTarget, setKickTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
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
  const playersRef = useRef<BunkerRoomState["players"]>([]);

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

  const roomState = useGameStore((state) => state.roomState);
  const error = useGameStore((state) => state.error);
  const setRoomState = useGameStore((state) => state.setRoomState);
  const patchTimer = useGameStore((state) => state.patchTimer);
  const setError = useGameStore((state) => state.setError);

  // Init session + origin
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    setOrigin(window.location.origin);
  }, []);

  // Clear store state if the cached room belongs to a different code — this
  // happens when navigating between rooms and prevents a flash of stale data.
  useEffect(() => {
    const cached = useGameStore.getState().roomState;
    if (cached && cached.room.code !== roomCode.toUpperCase()) {
      setRoomState(null);
      setLoading(true);
    }
  }, [roomCode, setRoomState]);

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
        void apiRequest<BunkerRoomState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`
        )
          .then((s) => setRoomState(s))
          .catch(() => {
            // ignore — server will broadcast room_state shortly.
          });
      }
      isReconnect = true;
    };

    const onDisconnect = () => {
      setSocketConnected(false);
    };

    const onState = (s: BunkerRoomState) => {
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
        void apiRequest<BunkerRoomState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`
        )
          .then((s) => setRoomState(s))
          .catch(() => undefined);
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
  }, [patchTimer, roomCode, sessionId, setError, setRoomState]);

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

  // Open situation overlay when new situation appears
  useEffect(() => {
    if (roomState?.room.status !== "PLAYING") {
      setSituationOpen(false);
      return;
    }
    const situation = roomState.game.situation;
    if (!situation || roomState.game.roundNumber < 1) return;

    const key = `${roomCode}-${roomState.game.roundNumber}-${situation.text}`;
    if (seenSituationKeysRef.current.has(key)) return;

    seenSituationKeysRef.current.add(key);
    setSituationOpen(true);
  }, [
    roomCode,
    roomState?.game.roundNumber,
    roomState?.game.situation,
    roomState?.room.status
  ]);

  // Keep latest players in a ref so announcement effects can read names
  // without re-running on every socket update.
  useEffect(() => {
    playersRef.current = roomState?.players ?? [];
  }, [roomState?.players]);

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
      title: `${player.name} o‘yindan chiqdi`,
      description:
        "Bu o‘yinchi endi ovoz bera olmaydi, lekin kuzatishda davom etadi."
    });
  }, [
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
    return `${roomCode}-${roomState?.game.roundNumber}-${s.text}`;
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
    const state = await apiRequest<BunkerRoomState>(
      `/api/rooms/${roomCode}/state?sessionId=${sessionId}`
    );
    setRoomState(state);
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
  const tgStartappLink = roomState
    ? buildTelegramStartappLink(roomState.room.code)
    : null;
  const insideTelegram = isInsideTelegram();

  async function handleCopyInviteLink() {
    if (!roomState) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
      pushToast({ kind: "success", text: "Link nusxalandi" });
      tgHaptic("light");
    } catch {
      pushToast({ kind: "error", text: "Nusxalab bo‘lmadi" });
    }
  }

  function handleTelegramShare() {
    if (!roomState) return;
    const linkToShare = tgStartappLink ?? inviteUrl;
    const text = `Bunker Online — ${roomState.room.code} xonasiga qo‘shiling`;
    const shareUrl = buildTelegramShareUrl(linkToShare, text);
    openTelegramLink(shareUrl);
  }

  async function handleShareInviteLink() {
    if (!roomState) return;
    // Inside Telegram: always open the native share sheet on the startapp
    // link so recipients land in the Mini App, not the public web URL.
    if (insideTelegram) {
      handleTelegramShare();
      return;
    }
    if (!navigator.share) {
      await handleCopyInviteLink();
      return;
    }
    try {
      await navigator.share({
        title: "Bunker Online",
        text: `Room ${roomState.room.code} ga qo‘shiling`,
        url: inviteUrl
      });
    } catch {
      // user cancelled, ignore
    }
  }

  // Derived
  const room = roomState?.room;
  const me = roomState?.me;
  const game = roomState?.game;
  const players = roomState?.players ?? [];
  const alivePlayers = players.filter((p) => p.isAlive);
  const currentTurnPlayer = players.find(
    (p) => p.id === game?.currentTurnPlayerId
  );
  // After the game ends every player (including self) is shown with full
  // cards open; mid-game we hide the self row because cards live in the
  // bottom-sheet "Mening kartalarim" instead.
  const isFinished = roomState?.room.status === "FINISHED";
  const otherPlayers = isFinished
    ? players
    : players.filter((p) => p.id !== me?.id);

  const myCards = useMemo(() => {
    if (!me) return [];
    return cardOrder.map((type) => ({
      type,
      label: cardLabels[type],
      value: me.cards[type],
      isRevealed: me.revealed.includes(type)
    }));
  }, [me]);

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

  // Loading & error states. Order matters: only show the spinner when we
  // truly have nothing to render. If the store still has state (e.g. we just
  // remounted because of a /room ↔ /game navigation), keep rendering the real
  // UI to avoid a flash.
  if (!roomState || !room || !game) {
    if (loading) {
      return (
        <main className="grid min-h-screen place-items-center bg-bg-base text-ink-secondary">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
            Room yuklanmoqda...
          </div>
        </main>
      );
    }
    return (
      <main className="grid min-h-screen place-items-center bg-bg-base px-5 text-ink-secondary">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-base font-semibold text-ink-primary">
            Room topilmadi.
          </p>
          <p className="text-sm text-ink-secondary">
            Bu xona o'chirilgan yoki kod noto'g'ri.
          </p>
          <button
            onClick={() => router.push("/")}
            className="flex h-12 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-bg-base transition active:scale-[0.98]"
          >
            Bosh sahifa
          </button>
        </div>
      </main>
    );
  }

  if (!me) {
    if (room.status !== "LOBBY") {
      const finished = room.status === "FINISHED" || room.status === "CANCELLED";
      return (
        <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
          <div className="mx-auto max-w-md pt-6">
            <p
              className={`text-xs font-medium uppercase tracking-wider ${finished ? "text-bad" : "text-warn"}`}
            >
              {finished ? "Yopiq" : "Boshlangan"}
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {finished
                ? "Bu o‘yin yakunlangan"
                : "Bu o‘yin allaqachon boshlangan"}
            </h1>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              {finished
                ? "Yangi o‘yin yarating yoki ochiq xona kodini so‘rang."
                : "O‘yin boshlanganidan keyin yangi o‘yinchi qo‘shila olmaydi. Yangi o‘yin yaratishingiz yoki boshqa xona kodi bilan kirishingiz mumkin."}
            </p>

            <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <p className="text-xs text-ink-muted">Room code</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
                {roomCode}
              </p>
            </div>

            <button
              onClick={() => router.push("/")}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              Bosh sahifa
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
              Taklif
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              Roomga kirish uchun tizimga kiring
            </h1>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Roomga qo'shilish uchun bot orqali bir martalik avtorizatsiya
              kerak. Tasdiqlangach to'g'ridan-to'g'ri shu xonaga tushasiz.
            </p>

            <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <p className="text-xs text-ink-muted">Room code</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
                {roomCode}
              </p>
            </div>

            <a
              href={loginHref}
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              <span aria-hidden>✈</span>
              Telegramda kirish
            </a>
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
        <div className="mx-auto max-w-md pt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-brand">
            Taklif
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            Roomga kirish uchun nickname yozing
          </h1>

          <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            <p className="text-xs text-ink-muted">Room code</p>
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
              placeholder="Nickname"
            />
            <button className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]">
              Roomga kirish
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
        <ConnectionBanner connected={socketConnected} />
        <div className="mx-auto max-w-xl px-5 pt-safe pb-32">
          <header className="flex items-center justify-between py-3">
            <button
              onClick={() => router.push("/")}
              className="-ml-2 flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm text-ink-secondary"
            >
              <span aria-hidden>←</span> Bosh sahifa
            </button>
            <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary">
              Lobby
            </span>
          </header>

          <section className="mt-2 rounded-3xl border border-line-subtle bg-bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              Room code
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em]">
              {room.code}
            </p>
            <p className="mt-2 text-sm text-ink-secondary">
              {players.length} / {room.maxPlayers} o‘yinchi · Finish:{" "}
              {room.winnerTarget} kishi
            </p>

            {me.isHost ? (
              <div className="mt-4 grid gap-2">
                {insideTelegram ? (
                  <button
                    onClick={handleTelegramShare}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
                  >
                    Telegram orqali ulashish
                  </button>
                ) : (
                  <>
                    {tgStartappLink ? (
                      <button
                        onClick={handleTelegramShare}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] text-sm font-semibold text-white transition active:scale-[0.98]"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path d="M21.9 4.5L18.7 19.8c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 13.1l-4.9-1.5C.1 11.3.1 10.6 1.4 10.1L20.4 2.8c1-.4 1.8.2 1.5 1.7z" />
                        </svg>
                        Telegram orqali ulashish
                      </button>
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleCopyInviteLink()}
                        className={`flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                          linkCopied
                            ? "bg-ok text-bg-base"
                            : "bg-brand text-bg-base"
                        }`}
                      >
                        {linkCopied ? (
                          <>
                            <span aria-hidden>✓</span>
                            Nusxalandi
                          </>
                        ) : (
                          "Linkni nusxalash"
                        )}
                      </button>
                      <button
                        onClick={() => void handleShareInviteLink()}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl border border-line-strong bg-bg-elevated text-sm font-semibold"
                      >
                        Ulashish
                      </button>
                    </div>
                  </>
                )}
                <p className="break-all rounded-xl bg-bg-base/60 px-3 py-2 text-xs text-ink-muted">
                  {inviteUrl}
                </p>
              </div>
            ) : null}
          </section>

          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">O‘yinchilar</h2>
              <p className="text-xs text-ink-muted">
                Kamida 3 kishi · {alivePlayers.length} ta tayyor
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
                  showPresence
                  revealedCards={{}}
                  isMe={p.id === me.id}
                  variant="tile"
                />
              ))}
            </ul>
          </section>

          {!me.isHost ? (
            <>
              <p className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface p-4 text-center text-sm text-ink-secondary">
                Host o‘yinni boshlashini kuting...
              </p>
              <button
                type="button"
                onClick={() => setLeaveConfirmOpen(true)}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad transition active:scale-[0.99]"
              >
                Roomdan chiqish
              </button>
            </>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              {error}
            </p>
          ) : null}
        </div>

        {me.isHost ? (
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
            // Host explicitly tore the lobby down — they don't need to see
            // the "O'yin yaratilmadi" modal that other participants get.
            // Send them straight to the dashboard so the click feels
            // immediate; the broadcast continues to the rest of the room
            // in the background.
            router.push("/");
          }}
          onClose={() => setEndGameConfirmOpen(false)}
        />
      </main>
    );
  }

  // ─── GAME VIEW ───────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <ConnectionBanner connected={socketConnected} />
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-line-subtle bg-bg-base/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 pt-safe pb-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Round{" "}
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
                ? "Reveal kutilmoqda"
                : votingFinished
                  ? "Eliminatsiya tugadi"
                  : phaseHelp[game.phase]}
              {currentTurnPlayer
                ? ` · ${currentTurnPlayer.name}${
                    currentTurnPlayer.id === me.id ? " (siz)" : ""
                  }`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Timer seconds={game.remainingSeconds} />
            <button
              onClick={toggleAudio}
              aria-label={audioEnabled ? "Ovozni o‘chirish" : "Ovoz yoqish"}
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
            Math.max(bottomBarHeight, me.isHost ? 240 : 140) + 24
        }}
      >
        {/* Disaster + situation summary */}
        {game.disaster || game.situation ? (
          <div
            key={`${game.roundNumber}-${game.situation?.text ?? "intro"}`}
            className="animate-fade-in rounded-2xl border border-line-subtle bg-bg-surface"
          >
            {game.disaster ? (
              <button
                type="button"
                onClick={() => setIntroOpen(true)}
                className="block w-full px-4 pt-3 pb-3 text-left transition active:opacity-80"
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
                  Fojea
                </p>
                <p className="mt-0.5 text-base font-semibold">
                  {game.disaster.name}
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
                  Round {game.roundNumber} vaziyati
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-primary">
                  {game.situation.text}
                </p>
              </button>
            ) : null}
          </div>
        ) : null}

        {room.status === "FINISHED" ? (
          <section className="mt-4 rounded-2xl border border-ok/30 bg-ok/10 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-ok">
              Yakuniy natija
            </p>
            <p className="mt-1 text-base font-semibold">
              Yutganlar:{" "}
              {winners.map((p) => p.name).join(", ") || "Hech kim qolmadi"}
            </p>
          </section>
        ) : null}

        {/* Players */}
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-primary">
              O‘yinchilar
            </h2>
            <p className="text-xs text-ink-muted">
              Tirik {alivePlayers.length} / {players.length}
            </p>
          </div>
          <ul className="grid gap-2">
            {otherPlayers.map((p) => (
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
          {me.isHost && room.status !== "FINISHED" ? (
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
                  hasMoreRevealPlayers ? "Keyingi o‘yinchi" : "Pitchni yakunlash"
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
              Pitchni tugatish
            </button>
          ) : null}

          {room.status === "FINISHED" ? (
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-ok text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              Bosh sahifaga qaytish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMyCardsOpen(true)}
              className="flex h-14 w-full items-center justify-between rounded-2xl border border-line-strong bg-bg-surface px-4 text-left transition active:scale-[0.99]"
            >
              <div>
                <p className="text-xs text-ink-muted">Mening kartalarim</p>
                <p className="text-sm font-semibold">
                  {myRevealedCount}/6 ochilgan
                  {!me.isAlive ? " · chiqqansiz" : ""}
                </p>
              </div>
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                Ko‘rish
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
          className="fixed inset-0 z-50 flex flex-col justify-end bg-bg-overlay backdrop-blur-sm"
        >
          <div className="absolute inset-0" />
          <div className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-line-subtle bg-bg-surface px-5 pt-4 pb-safe">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-brand">
                  Mening kartalarim
                </p>
                <h2 className="mt-0.5 text-lg font-semibold">
                  {myRevealedCount}/6 ochilgan
                </h2>
              </div>
              <button
                onClick={() => setMyCardsOpen(false)}
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
                        Ochiq
                      </span>
                    ) : (
                      <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                        Yashirin
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
            {disasterImage[game.disaster.name] ? (
              // Banner image — sits flush to the modal edges so the
              // imagery feels cinematic. Bottom gradient ensures the
              // "Fojea" pill stays legible against bright artwork.
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <Image
                  src={disasterImage[game.disaster.name]}
                  alt={game.disaster.name}
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
                Fojea
              </p>
              <h2 className="mt-1 text-2xl font-bold">{game.disaster.name}</h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                {game.disaster.description}
              </p>
              <div className="mt-5 grid gap-2">
                <button
                  onClick={() => setIntroOpen(false)}
                  className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
                >
                  Tushundim
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
          className="fixed inset-0 z-40 flex items-end justify-center bg-bg-overlay backdrop-blur-sm sm:items-center"
        >
          <div className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border-t border-line-subtle bg-bg-surface p-5 pb-safe shadow-pop sm:rounded-3xl sm:border">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            <p className="text-xs font-medium uppercase tracking-wider text-warn">
              Round {game.roundNumber} vaziyati
            </p>
            <p className="mt-3 text-base leading-7 text-ink-primary">
              {game.situation.text}
            </p>
            <button
              onClick={() => setSituationOpen(false)}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              Roundga kirish
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
              Sizning navbatingiz
            </p>
            <h2 className="mt-1 text-2xl font-bold">Bitta kartani tanlang</h2>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              Tanlaganingizdan keyin 2 daqiqada nega aynan shu kartani
              ochganingizni tushuntirasiz.
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
          players={players.map((p) => ({
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
                Eliminatsiya
              </p>
              <h2 className="mt-2 text-2xl font-bold text-ink-primary">
                Siz bunkerdan chiqarildingiz
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                Sizning kartalaringiz endi hammaga ochiq. Ovoz bera
                olmaysiz, lekin o‘yin oxirigacha kuzatib turishingiz mumkin.
              </p>
            </div>

            <div className="px-5 pt-5 pb-5">
              <button
                onClick={() => setEliminatedModalOpen(false)}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-bad text-base font-semibold text-white transition active:scale-[0.98]"
              >
                Kuzatishda davom etish
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
                {me.isAlive ? "G‘alaba" : "O‘yin tugadi"}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-ink-primary">
                {me.isAlive
                  ? "Siz bunkerda omon qoldingiz!"
                  : "Bu safar omad yor bo‘lmadi"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                {me.isAlive
                  ? "Tabriklaymiz — insoniyatning kelajagini siz tiklaysiz."
                  : "Siz o‘yindan chiqib ketgansiz, lekin o‘yin yakunlandi."}
                {winners.length > 0
                  ? ` Bunkerda qolganlar: ${winners
                      .map((w) => w.name)
                      .join(", ")}.`
                  : " Bunkerda hech kim qolmadi."}
              </p>
            </div>

            <div className="grid gap-2 px-5 pt-5 pb-5">
              <button
                onClick={() => setWinnerModalOpen(false)}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
              >
                Natijani ko‘rish
              </button>
              <button
                onClick={() => router.push("/")}
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-elevated text-sm font-semibold text-ink-primary"
              >
                Bosh sahifa
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={endGameConfirmOpen}
        title="O‘yinni tugatmoqchimisiz?"
        description="O‘yin shu zahoti yakunlanadi va barcha ishtirokchilar uchun tugaydi. Bu amalni bekor qilib bo‘lmaydi."
        confirmLabel="Ha, tugatish"
        cancelLabel="Yo‘q"
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
          kickTarget ? `${kickTarget.name}ni o‘yindan chiqarish?` : ""
        }
        description="Ushbu o‘yinchining barcha kartalari ochiladi va u o‘yindan chiqib ketgan deb belgilanadi. Buni odatda biror o‘yinchi tarmoqdan tushib qolib, o‘yin to‘xtab qolganda ishlating."
        confirmLabel="Chiqarish"
        cancelLabel="Bekor qilish"
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
        title="Roomdan chiqasizmi?"
        description="Siz xonadan chiqasiz va o‘yin boshlanganda ishtirok etmaysiz. Xohlasangiz keyin link orqali yana qo‘shilishingiz mumkin."
        confirmLabel="Ha, chiqish"
        cancelLabel="Bekor qilish"
        tone="danger"
        onConfirm={() => {
          emit("leave_room");
          setLeaveConfirmOpen(false);
          router.push("/");
        }}
        onClose={() => setLeaveConfirmOpen(false)}
      />

      {/* Lobby cancellation modal — host tugatdi, o'yin umuman bo'lmadi. */}
      {cancelledModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border border-line-strong bg-bg-surface p-6 text-center shadow-pop">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-warn/40 bg-warn/10 text-2xl">
              🚫
            </div>
            <h3 className="mt-4 text-xl font-bold text-ink-primary">
              O'yin yaratilmadi
            </h3>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Host xonani o'yin boshlanmasdan turib tugatdi. Yangi o'yinda
              ishtirok etish uchun bosh sahifaga qayting.
            </p>
            <button
              type="button"
              onClick={() => {
                setCancelledModalOpen(false);
                router.push("/");
              }}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
            >
              Bosh sahifa
            </button>
          </div>
        </div>
      ) : null}

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
          onClick={() => setRevealModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-line-strong bg-bg-surface p-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
              Karta ochildi
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
                    {cardLabels[revealModal.newCardType]} · yangi
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
                  Avval ochilganlar
                </p>
                <ul className="mt-2 grid gap-2">
                  {revealModal.olderCards.map((c) => (
                    <li
                      key={c.type}
                      className="rounded-xl border border-line-subtle bg-bg-base/60 px-3 py-2"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                        {cardLabels[c.type]}
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
              Tushundim
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

// Small toast-style banner that floats over content while the realtime
// socket is dropped. Pinned to the top under any safe-area inset so it
// doesn't collide with Telegram's chrome.
function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 grid place-items-center pt-safe">
      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/20 px-3 py-1 text-xs font-medium text-warn shadow-pop backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
        Qayta ulanmoqda…
      </div>
    </div>
  );
}
