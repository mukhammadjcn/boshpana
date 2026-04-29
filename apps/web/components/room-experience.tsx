"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { HostControls } from "@/components/host-controls";
import { PlayerCard } from "@/components/player-card";
import { Timer } from "@/components/timer";
import { VotePanel } from "@/components/vote-panel";
import { useGameAudio } from "@/components/game/use-game-audio";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { getOrCreateSessionId } from "@/lib/storage";
import type { CardType, GamePhase, RoomState } from "@/lib/types";
import { useGameStore } from "@/store/useGameStore";

const cardLabels: Record<CardType, string> = {
  PROFESSION: "Kasb",
  HEALTH: "Sog‘liq",
  CHARACTER: "Xarakter",
  SKILL: "Ko‘nikma",
  BAGGAGE: "Bagaj",
  FACT: "Fakt"
};

const cardOrder: CardType[] = [
  "PROFESSION",
  "HEALTH",
  "CHARACTER",
  "SKILL",
  "BAGGAGE",
  "FACT"
];

const phaseHelp: Record<GamePhase, string> = {
  LOBBY: "Lobby — kuting",
  INTRO: "Tanishuv",
  ROUND_REVEAL: "Karta ochish navbati",
  ROUND_PITCH: "Pitch — 2 daqiqa",
  ROUND_COMPLETE: "Round yakuni",
  VOTING: "Ovoz berish",
  FINISHED: "Yakun"
};

type RoomExperienceProps = {
  roomCode: string;
  view: "room" | "game";
};

type Announcement = {
  key: string;
  title: string;
  description: string;
};

export function RoomExperience({ roomCode, view }: RoomExperienceProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [situationOpen, setSituationOpen] = useState(false);
  const [myCardsOpen, setMyCardsOpen] = useState(false);
  const [eliminatedModalOpen, setEliminatedModalOpen] = useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const connectedRef = useRef(false);
  const seenSituationKeysRef = useRef<Set<string>>(new Set());
  const seenRevealAnnouncementRef = useRef<Set<string>>(new Set());
  const seenElimAnnouncementRef = useRef<Set<string>>(new Set());
  const seenSelfEliminationRef = useRef<Set<string>>(new Set());
  const seenWinnerModalRef = useRef<Set<string>>(new Set());
  const playersRef = useRef<RoomState["players"]>([]);

  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);

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

  // Measure sticky bottom bar so content padding stays in sync.
  useLayoutEffect(() => {
    const node = bottomBarRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      if (node) setBottomBarHeight(node.offsetHeight);
      return;
    }
    const ro = new ResizeObserver(() => {
      setBottomBarHeight(node.offsetHeight);
    });
    ro.observe(node);
    setBottomBarHeight(node.offsetHeight);
    return () => ro.disconnect();
  }, [roomState?.me?.isHost, roomState?.room.status, roomState?.game.phase]);

  // Initial state load
  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    void (async () => {
      try {
        const state = await apiRequest<RoomState>(
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

  // Socket
  useEffect(() => {
    if (!sessionId || connectedRef.current) return;

    const socket = getSocket();
    socket.connect();
    socket.emit("join_room", { roomCode, sessionId });

    const onState = (s: RoomState) => {
      setRoomState(s);
      setLoading(false);
    };
    const onTimer = ({ remainingSeconds }: { remainingSeconds: number }) => {
      patchTimer(remainingSeconds);
    };
    const onErr = ({ message }: { message: string }) => setError(message);

    socket.on("room_state", onState);
    socket.on("timer_update", onTimer);
    socket.on("action_error", onErr);
    connectedRef.current = true;

    return () => {
      socket.off("room_state", onState);
      socket.off("timer_update", onTimer);
      socket.off("action_error", onErr);
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

  // Reveal announcement — only re-fires when the actual reveal id changes.
  useEffect(() => {
    if (
      !roomState?.game.lastRevealedPlayerId ||
      !roomState.game.lastRevealedCardType
    )
      return;

    const key = `${roomState.game.roundNumber}-${roomState.game.lastRevealedPlayerId}-${roomState.game.lastRevealedCardType}`;
    if (seenRevealAnnouncementRef.current.has(key)) return;

    const player = playersRef.current.find(
      (p) => p.id === roomState.game.lastRevealedPlayerId
    );
    if (!player) return;

    seenRevealAnnouncementRef.current.add(key);
    setAnnouncement({
      key,
      title: `${player.name} kartasini ochdi`,
      description: `${cardLabels[roomState.game.lastRevealedCardType]} endi hammaga ko‘rinadi.`
    });
  }, [
    roomState?.game.lastRevealedCardType,
    roomState?.game.lastRevealedPlayerId,
    roomState?.game.roundNumber
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
    setAnnouncement({
      key,
      title: `${player.name} o‘yindan chiqdi`,
      description:
        "Bu o‘yinchi endi ovoz bera olmaydi, lekin kuzatishda davom etadi."
    });
  }, [
    roomState?.game.lastEliminatedPlayerId,
    roomState?.game.roundNumber
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
    setEliminatedModalOpen(true);
  }, [
    roomState?.game.lastEliminatedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me?.id
  ]);

  // Open the "you survived" modal once per finished game when I'm a winner.
  useEffect(() => {
    if (roomState?.room.status !== "FINISHED") return;
    if (!roomState.me?.isAlive) return;
    const code = roomState.room.code;
    const meId = roomState.me.id;
    const key = `winner-${code}-${meId}`;
    if (seenWinnerModalRef.current.has(key)) return;
    seenWinnerModalRef.current.add(key);
    setWinnerModalOpen(true);
  }, [
    roomState?.room.status,
    roomState?.room.code,
    roomState?.me?.id,
    roomState?.me?.isAlive
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
    meRevealKey,
    meEliminationKey
  });

  // Helpers
  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiRequest(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        body: JSON.stringify({ name: joinName, sessionId })
      });
      const socket = getSocket();
      socket.emit("join_room", { roomCode, sessionId });
      const state = await apiRequest<RoomState>(
        `/api/rooms/${roomCode}/state?sessionId=${sessionId}`
      );
      setRoomState(state);
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  function emit(event: string, payload?: Record<string, unknown>) {
    const socket = getSocket();
    socket.emit(event, { roomCode, sessionId, ...(payload ?? {}) });
  }

  const inviteUrl = roomState ? `${origin || ""}/room/${roomState.room.code}` : "";

  async function handleCopyInviteLink() {
    if (!roomState) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareFeedback("Link nusxalandi");
      window.setTimeout(() => setShareFeedback(null), 2000);
    } catch {
      setShareFeedback("Nusxalab bo‘lmadi");
    }
  }

  async function handleShareInviteLink() {
    if (!roomState) return;
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
  const otherPlayers = players.filter((p) => p.id !== me?.id);

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

  // Loading & error states
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

  if (!roomState || !room || !game) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg-base text-ink-secondary">
        Room topilmadi.
      </main>
    );
  }

  if (!me) {
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
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleCopyInviteLink()}
                    className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
                  >
                    Linkni nusxalash
                  </button>
                  <button
                    onClick={() => void handleShareInviteLink()}
                    className="flex h-12 flex-1 items-center justify-center rounded-xl border border-line-strong bg-bg-elevated text-sm font-semibold"
                  >
                    Ulashish
                  </button>
                </div>
                <p className="break-all rounded-xl bg-bg-base/60 px-3 py-2 text-xs text-ink-muted">
                  {inviteUrl}
                </p>
                {shareFeedback ? (
                  <p className="text-xs text-ok">{shareFeedback}</p>
                ) : null}
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
                  revealedCards={{}}
                  isMe={p.id === me.id}
                  variant="tile"
                />
              ))}
            </ul>
          </section>

          {!me.isHost ? (
            <p className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface p-4 text-center text-sm text-ink-secondary">
              Host o‘yinni boshlashini kuting...
            </p>
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
                onEndGame={() => {
                  if (window.confirm("Rostdan ham o‘yinni tugatmoqchimisiz?")) {
                    emit("end_game");
                  }
                }}
              />
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  // ─── GAME VIEW ───────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
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
            <p className="truncate text-sm font-semibold text-ink-primary">
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
        style={{ paddingBottom: bottomBarHeight + 24 }}
      >
        {/* Disaster + situation summary */}
        {game.disaster ? (
          <button
            type="button"
            onClick={() => setIntroOpen(true)}
            className="w-full rounded-2xl border border-line-subtle bg-bg-surface p-4 text-left transition active:scale-[0.99]"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
              Fojea
            </p>
            <p className="mt-1 text-base font-semibold">{game.disaster.name}</p>
            <p className="mt-1 line-clamp-2 text-sm text-ink-secondary">
              {game.disaster.description}
            </p>
          </button>
        ) : null}

        {game.situation ? (
          <button
            type="button"
            onClick={() => setSituationOpen(true)}
            className="mt-3 w-full rounded-2xl border border-line-subtle bg-bg-surface p-4 text-left transition active:scale-[0.99]"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-warn">
              Round {game.roundNumber} vaziyati
            </p>
            <p className="mt-1 line-clamp-3 text-sm leading-6 text-ink-primary">
              {game.situation.text}
            </p>
          </button>
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
            <button
              onClick={() => router.push("/")}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-ok text-sm font-semibold text-bg-base"
            >
              Bosh sahifaga qaytish
            </button>
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
                revealedCards={p.visibleCards}
                isCurrentTurn={p.id === game.currentTurnPlayerId}
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
        ref={bottomBarRef}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-bg-base/95 backdrop-blur"
      >
        <div className="mx-auto max-w-xl px-4 pt-3 pb-safe">
          {me.isHost ? (
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
                onEndGame={() => {
                  if (window.confirm("Rostdan ham o‘yinni tugatmoqchimisiz?")) {
                    emit("end_game");
                  }
                }}
              />
            </div>
          ) : null}

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
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border-t border-line-subtle bg-bg-surface p-5 pb-safe shadow-pop sm:rounded-3xl sm:border">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              Fojea
            </p>
            <h2 className="mt-1 text-2xl font-bold">{game.disaster.name}</h2>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              {game.disaster.description}
            </p>
            <div className="mt-5 grid gap-2">
              {me.isHost && game.phase === "INTRO" ? (
                <button
                  onClick={() => {
                    setIntroOpen(false);
                    emit("start_round");
                  }}
                  className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
                >
                  1-roundni boshlash
                </button>
              ) : null}
              <button
                onClick={() => setIntroOpen(false)}
                className="flex h-12 items-center justify-center rounded-2xl border border-line-strong bg-bg-elevated text-sm font-semibold"
              >
                Tushundim
              </button>
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
          onVote={(targetPlayerId) => emit("vote", { targetPlayerId })}
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

      {/* Winner modal */}
      {winnerModalOpen ? (
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
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-brand/40 bg-brand/15">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-brand"
                  aria-hidden
                >
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                  <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
                  <path d="M17 4h3v3a3 3 0 0 1-3 3" />
                  <path d="M7 4H4v3a3 3 0 0 0 3 3" />
                </svg>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-brand">
                G‘alaba
              </p>
              <h2 className="mt-2 text-2xl font-bold text-ink-primary">
                Siz bunkerda omon qoldingiz!
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                Tabriklaymiz — insoniyatning kelajagini siz tiklaysiz.
                {winners.length > 1
                  ? ` ${winners.length} ta yutuvchi: ${winners
                      .map((w) => w.name)
                      .join(", ")}.`
                  : ""}
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
    </main>
  );
}
