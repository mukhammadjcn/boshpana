"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { HostControls } from "@/components/host-controls";
import { PlayerCard } from "@/components/player-card";
import { Timer } from "@/components/timer";
import { VotePanel } from "@/components/vote-panel";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { getOrCreateSessionId } from "@/lib/storage";
import type { CardType, RoomState } from "@/lib/types";
import { useGameStore } from "@/store/useGameStore";

const cardLabels: Record<CardType, string> = {
  PROFESSION: "Kasb",
  HEALTH: "Sog'liq",
  CHARACTER: "Xarakter",
  SKILL: "Ko'nikma",
  BAGGAGE: "Bagaj",
  FACT: "Fakt",
};

const cardOrder: CardType[] = [
  "PROFESSION",
  "HEALTH",
  "CHARACTER",
  "SKILL",
  "BAGGAGE",
  "FACT",
];

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
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const connectedRef = useRef(false);
  const seenSituationKeysRef = useRef<Set<string>>(new Set());
  const seenRevealAnnouncementKeysRef = useRef<Set<string>>(new Set());
  const seenEliminationAnnouncementKeysRef = useRef<Set<string>>(new Set());
  const audioEnabledRef = useRef(false);
  const didPreloadAudioRef = useRef(false);
  const preloadedAudiosRef = useRef<Set<string>>(new Set());
  const preloadedAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(
    new Map(),
  );
  const seenRevealSoundKeysRef = useRef<Set<string>>(new Set());
  const seenEliminationSoundKeysRef = useRef<Set<string>>(new Set());
  const situationAudioMapRef = useRef<Map<string, string>>(new Map());
  const activeAudiosRef = useRef<HTMLAudioElement[]>([]);
  const introLoopAudioRef = useRef<HTMLAudioElement | null>(null);
  const situationLoopAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentSituationAudioRef = useRef<string | null>(null);
  const roomState = useGameStore((state) => state.roomState);
  const error = useGameStore((state) => state.error);
  const setRoomState = useGameStore((state) => state.setRoomState);
  const patchTimer = useGameStore((state) => state.patchTimer);
  const setError = useGameStore((state) => state.setError);

  const gameStartAudio = "/gamestart.mp3";
  const killedAudio = "/killed.mp3";
  const revealAudios = [
    "/reveal1.mp3",
    "/reveal2.mp3",
    "/reveal3.mp3",
    "/reveal4.mp3",
    "/reveal5.mp3",
    "/reveal6.mp3",
  ];
  const situationAudios = [
    "/situation2.mp3",
    "/situation3.mp3",
    "/situation4.mp3",
    "/situation5.mp3",
    "/situation6.mp3",
    "/situation7.mp3",
  ];

  function shouldPreloadAudios() {
    const connection = (
      navigator as Navigator & {
        connection?: {
          effectiveType?: string;
          downlink?: number;
          saveData?: boolean;
        };
      }
    ).connection;

    if (!connection) {
      return true;
    }

    if (connection.saveData) {
      return false;
    }

    if (
      connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g"
    ) {
      return false;
    }

    if (typeof connection.downlink === "number" && connection.downlink < 1.5) {
      return false;
    }

    return true;
  }

  function preloadAudio(src: string) {
    if (preloadedAudiosRef.current.has(src)) {
      return;
    }

    const audio = new Audio();
    audio.preload = "auto";
    audio.src = src;
    audio.load();

    preloadedAudiosRef.current.add(src);
    preloadedAudioElementsRef.current.set(src, audio);
  }

  function stopAllAudios() {
    activeAudiosRef.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudiosRef.current = [];
  }

  function stopLoopAudio(targetRef: React.MutableRefObject<HTMLAudioElement | null>) {
    const audio = targetRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    activeAudiosRef.current = activeAudiosRef.current.filter(
      (item) => item !== audio,
    );
    targetRef.current = null;
  }

  function playAudio(src: string, volume = 0.9) {
    if (!audioEnabledRef.current) {
      return;
    }

    const audio = new Audio(src);
    audio.volume = volume;
    activeAudiosRef.current.push(audio);

    const cleanup = () => {
      activeAudiosRef.current = activeAudiosRef.current.filter(
        (item) => item !== audio,
      );
    };

    audio.addEventListener("ended", cleanup);
    audio.addEventListener("pause", cleanup);
    void audio.play().catch(() => {
      cleanup();
    });
  }

  function playLoopAudio(
    src: string,
    volume: number,
    targetRef: React.MutableRefObject<HTMLAudioElement | null>,
  ) {
    if (!audioEnabledRef.current) {
      return;
    }

    const existing = targetRef.current;
    if (existing && existing.src.includes(src) && !existing.paused) {
      return;
    }

    stopLoopAudio(targetRef);

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = volume;
    targetRef.current = audio;
    activeAudiosRef.current.push(audio);
    void audio.play().catch(() => {
      stopLoopAudio(targetRef);
    });
  }

  function pickRandom(items: string[]) {
    if (!items.length) {
      return null;
    }

    const index = Math.floor(Math.random() * items.length);
    return items[index] ?? null;
  }

  function hashString(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getSituationAudioForKey(key: string) {
    const existing = situationAudioMapRef.current.get(key);
    if (existing) {
      return existing;
    }

    if (!situationAudios.length) {
      return null;
    }

    const index = hashString(key) % situationAudios.length;
    const selected = situationAudios[index] ?? situationAudios[0];
    if (selected) {
      situationAudioMapRef.current.set(key, selected);
    }
    return selected ?? null;
  }

  const toggleAudio = useCallback(() => {
    setAudioEnabled((current) => !current);
  }, []);

  useEffect(() => {
    const currentSessionId = getOrCreateSessionId();
    setSessionId(currentSessionId);
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (didPreloadAudioRef.current || !shouldPreloadAudios()) {
      return;
    }

    didPreloadAudioRef.current = true;
    const sources = [
      gameStartAudio,
      killedAudio,
      ...revealAudios,
      ...situationAudios,
    ];

    sources.forEach((src) => preloadAudio(src));
  }, [gameStartAudio, killedAudio, revealAudios, situationAudios]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;

    if (!audioEnabled) {
      stopAllAudios();
    }
  }, [audioEnabled]);

  useEffect(() => {
    if (!audioEnabled) {
      return;
    }

    const attemptPlayback = () => {
      if (!audioEnabledRef.current) {
        return;
      }

      if (introOpen) {
        playLoopAudio(gameStartAudio, 0.9, introLoopAudioRef);
      }

      if (situationOpen) {
        if (currentSituationAudioRef.current) {
          playLoopAudio(
            currentSituationAudioRef.current,
            0.8,
            situationLoopAudioRef,
          );
        }
      }
    };

    window.addEventListener("pointerdown", attemptPlayback);
    window.addEventListener("keydown", attemptPlayback);

    return () => {
      window.removeEventListener("pointerdown", attemptPlayback);
      window.removeEventListener("keydown", attemptPlayback);
    };
  }, [audioEnabled, gameStartAudio, introOpen, situationOpen]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let active = true;

    async function loadState() {
      try {
        const state = await apiRequest<RoomState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
        );

        if (active) {
          setRoomState(state);
        }
      } catch (nextError) {
        if (active) {
          setError((nextError as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadState();

    return () => {
      active = false;
    };
  }, [roomCode, sessionId, setError, setRoomState]);

  useEffect(() => {
    if (!sessionId || connectedRef.current) {
      return;
    }

    const socket = getSocket();

    socket.connect();
    socket.emit("join_room", { roomCode, sessionId });

    const roomStateHandler = (nextState: RoomState) => {
      setRoomState(nextState);
      setLoading(false);
    };

    const timerHandler = ({
      remainingSeconds,
    }: {
      remainingSeconds: number;
    }) => {
      patchTimer(remainingSeconds);
    };

    const errorHandler = ({ message }: { message: string }) => {
      setError(message);
    };

    socket.on("room_state", roomStateHandler);
    socket.on("timer_update", timerHandler);
    socket.on("action_error", errorHandler);
    connectedRef.current = true;

    return () => {
      socket.off("room_state", roomStateHandler);
      socket.off("timer_update", timerHandler);
      socket.off("action_error", errorHandler);
      connectedRef.current = false;
    };
  }, [patchTimer, roomCode, sessionId, setError, setRoomState]);

  useEffect(() => {
    if (!roomState) {
      return;
    }

    if (view === "room" && roomState.room.status !== "LOBBY") {
      router.replace(`/game/${roomCode}`);
    }

    if (view === "game" && roomState.room.status === "LOBBY") {
      router.replace(`/room/${roomCode}`);
    }
  }, [roomCode, roomState, router, view]);

  useEffect(() => {
    if (roomState?.game.phase === "INTRO") {
      setIntroOpen(true);
    }
  }, [roomState?.game.phase]);

  useEffect(() => {
    if (!introOpen) {
      stopLoopAudio(introLoopAudioRef);
      return;
    }

    playLoopAudio(gameStartAudio, 0.9, introLoopAudioRef);
  }, [introOpen, audioEnabled, gameStartAudio]);

  useEffect(() => {
    if (roomState?.room.status !== "PLAYING") {
      setSituationOpen(false);
      return;
    }

    const situation = roomState.game.situation;

    if (!situation || roomState.game.roundNumber < 1) {
      return;
    }

    const key = `${roomCode}-${roomState.game.roundNumber}-${situation.text}`;

    if (seenSituationKeysRef.current.has(key)) {
      return;
    }

    seenSituationKeysRef.current.add(key);
    setSituationOpen(true);
    currentSituationAudioRef.current = getSituationAudioForKey(key);
  }, [
    roomCode,
    roomState?.game.roundNumber,
    roomState?.game.situation,
    roomState?.room.status,
  ]);

  useEffect(() => {
    if (!situationOpen) {
      stopLoopAudio(situationLoopAudioRef);
      currentSituationAudioRef.current = null;
      return;
    }

    if (!currentSituationAudioRef.current) {
      const situation = roomState?.game.situation;
      if (situation && (roomState?.game.roundNumber ?? 0) > 0) {
        const key = `${roomCode}-${roomState.game.roundNumber}-${situation.text}`;
        currentSituationAudioRef.current = getSituationAudioForKey(key);
      }
    }

    if (currentSituationAudioRef.current) {
      playLoopAudio(currentSituationAudioRef.current, 0.8, situationLoopAudioRef);
    }
  }, [
    audioEnabled,
    roomCode,
    roomState?.game.roundNumber,
    roomState?.game.situation,
    situationOpen,
  ]);

  useEffect(() => {
    if (
      !roomState?.game.lastRevealedPlayerId ||
      !roomState.game.lastRevealedCardType
    ) {
      return;
    }

    const player = roomState.players.find(
      (item) => item.id === roomState.game.lastRevealedPlayerId,
    );

    if (!player) {
      return;
    }

    const key = `${roomState.game.roundNumber}-${roomState.game.lastRevealedPlayerId}-${roomState.game.lastRevealedCardType}`;

    if (seenRevealAnnouncementKeysRef.current.has(key)) {
      return;
    }

    seenRevealAnnouncementKeysRef.current.add(key);
    setAnnouncement({
      key,
      title: `${player.name} kartasini ochdi`,
      description: `${cardLabels[roomState.game.lastRevealedCardType]} endi hammaga ko‘rinadi.`,
    });

    const timeout = window.setTimeout(() => {
      setAnnouncement((current) => (current?.key === key ? null : current));
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [
    roomState?.game.lastRevealedCardType,
    roomState?.game.lastRevealedPlayerId,
    roomState?.game.roundNumber,
    roomState?.players,
  ]);

  useEffect(() => {
    if (!roomState?.game.lastEliminatedPlayerId) {
      return;
    }

    const player = roomState.players.find(
      (item) => item.id === roomState.game.lastEliminatedPlayerId,
    );

    if (!player) {
      return;
    }

    const key = `eliminated-${roomState.game.roundNumber}-${player.id}`;

    if (seenEliminationAnnouncementKeysRef.current.has(key)) {
      return;
    }

    seenEliminationAnnouncementKeysRef.current.add(key);
    setAnnouncement({
      key,
      title: `${player.name} o‘yindan chiqdi`,
      description:
        "Bu o‘yinchi endi ovoz bera olmaydi, lekin kuzatishda davom etadi.",
    });

    const timeout = window.setTimeout(() => {
      setAnnouncement((current) => (current?.key === key ? null : current));
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [
    roomState?.game.lastEliminatedPlayerId,
    roomState?.game.roundNumber,
    roomState?.players,
  ]);

  useEffect(() => {
    if (!roomState?.game || !roomState.me) {
      return;
    }

    if (!roomState.game.lastRevealedPlayerId) {
      return;
    }

    if (roomState.game.lastRevealedPlayerId !== roomState.me.id) {
      return;
    }

    const revealKey = `${roomState.game.roundNumber}-${roomState.game.lastRevealedPlayerId}-${roomState.game.lastRevealedCardType ?? ""}`;
    if (seenRevealSoundKeysRef.current.has(revealKey)) {
      return;
    }

    seenRevealSoundKeysRef.current.add(revealKey);
    const audio = pickRandom(revealAudios);
    if (audio) {
      playAudio(audio, 0.9);
    }
  }, [
    roomState?.game.lastRevealedCardType,
    roomState?.game.lastRevealedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me,
  ]);

  useEffect(() => {
    if (!roomState?.game?.lastEliminatedPlayerId || !roomState.me) {
      return;
    }

    if (roomState.game.lastEliminatedPlayerId !== roomState.me.id) {
      return;
    }

    const key = `eliminated-${roomState.game.roundNumber}-${roomState.me.id}`;
    if (seenEliminationSoundKeysRef.current.has(key)) {
      return;
    }

    seenEliminationSoundKeysRef.current.add(key);
    playAudio(killedAudio, 0.9);
  }, [
    roomState?.game.lastEliminatedPlayerId,
    roomState?.game.roundNumber,
    roomState?.me,
  ]);

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await apiRequest(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        body: JSON.stringify({
          name: joinName,
          sessionId,
        }),
      });

      const socket = getSocket();
      socket.emit("join_room", { roomCode, sessionId });
      const state = await apiRequest<RoomState>(
        `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
      );
      setRoomState(state);
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  function emit(event: string, payload?: Record<string, unknown>) {
    const socket = getSocket();
    socket.emit(event, {
      roomCode,
      sessionId,
      ...(payload ?? {}),
    });
  }

  async function handleCopyInviteLink() {
    if (!roomState) {
      return;
    }

    const inviteUrl = `${origin || ""}/room/${roomState.room.code}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareFeedback("Invite link nusxalandi.");
    } catch {
      setShareFeedback("Linkni nusxalab bo‘lmadi.");
    }
  }

  async function handleShareInviteLink() {
    if (!roomState) {
      return;
    }

    const inviteUrl = `${origin || ""}/room/${roomState.room.code}`;

    if (!navigator.share) {
      await handleCopyInviteLink();
      return;
    }

    try {
      await navigator.share({
        title: "Bunker Online",
        text: `Room ${roomState.room.code} ga qo‘shiling`,
        url: inviteUrl,
      });
      setShareFeedback("Invite link ulashildi.");
    } catch {
      setShareFeedback(null);
    }
  }

  const room = roomState?.room;
  const me = roomState?.me;
  const game = roomState?.game;
  const players = roomState?.players ?? [];
  const alivePlayers = players.filter((player) => player.isAlive);
  const currentTurnPlayer = players.find(
    (player) => player.id === game?.currentTurnPlayerId,
  );
  const otherPlayers = players.filter((player) => player.id !== me?.id);
  const hasStarted = room?.status === "PLAYING" || room?.status === "FINISHED";
  const inviteUrl = room ? `${origin || ""}/room/${room.code}` : "";
  const roundRevealTarget = (game?.roundNumber ?? 0) + 1;
  const hasMoreRevealPlayers = players.some(
    (player) =>
      player.isAlive &&
      player.id !== game?.currentTurnPlayerId &&
      player.revealedCount < roundRevealTarget,
  );

  const myCards = useMemo(() => {
    if (!me) {
      return [];
    }

    return cardOrder.map((type) => ({
      type,
      label: cardLabels[type],
      value: me.cards[type],
      isRevealed: me.revealed.includes(type),
    }));
  }, [me]);

  const revealOptions = useMemo(
    () =>
      myCards.filter(
        (card) =>
          card.type !== "PROFESSION" && !me?.revealed.includes(card.type),
      ),
    [me?.revealed, myCards],
  );

  const isMyRevealTurn =
    !!me &&
    me.isAlive &&
    game?.phase === "ROUND_REVEAL" &&
    game.currentTurnPlayerId === me.id;
  const canVote = !!me && me.isAlive && game?.phase === "VOTING";
  const shouldShowRevealModal = isMyRevealTurn && !situationOpen;
  const winners = players.filter((player) => player.isAlive);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Room yuklanmoqda...
      </main>
    );
  }

  if (!roomState || !room || !game) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Room state topilmadi.
      </main>
    );
  }

  if (!me) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_22%),linear-gradient(180deg,#08111f_0%,#020617_100%)] px-4 py-10 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-sky-950/10">
          <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">
            Taklif linki
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            Roomga kirish uchun nickname yozing
          </h1>
          <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
              Room code
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[0.28em] text-white">
              {roomCode}
            </p>
          </div>

          <form onSubmit={handleJoin} className="mt-6 grid gap-4">
            <input
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
              required
              className="h-12 rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 text-white outline-none"
              placeholder="Nickname"
            />
            <button className="h-12 rounded-full bg-orange-500 text-sm font-semibold text-slate-950">
              Roomga kirish
            </button>
          </form>
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        </div>
      </main>
    );
  }

  const hostControls = (
    <HostControls
      isHost={me.isHost}
      canStartGame={room.status === "LOBBY" && players.length >= 3}
      canStartRound={room.status === "PLAYING" && game.phase === "INTRO"}
      canAdvanceTurn={room.status === "PLAYING" && game.phase === "ROUND_PITCH"}
      advanceTurnLabel={
        hasMoreRevealPlayers ? "Keyingi o‘yinchi" : "Pitchni yakunlash"
      }
      canStartVoting={
        room.status === "PLAYING" && game.phase === "ROUND_COMPLETE"
      }
      canSkipVoting={
        room.status === "PLAYING" && game.phase === "ROUND_COMPLETE"
      }
      onStartGame={() => emit("start_game")}
      onStartRound={() => emit("start_round")}
      onAdvanceTurn={() => emit("advance_turn")}
      onStartVoting={() => emit("start_voting")}
      onSkipVoting={() => emit("skip_voting")}
      onEndGame={() => {
        if (window.confirm("Rostdan ham o‘yinni tugatmoqchimisiz?")) {
          emit("end_game");
        }
      }}
    />
  );

  if (room.status === "LOBBY") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.14),transparent_24%),linear-gradient(180deg,#050b15_0%,#020617_100%)] px-4 py-6 text-white">
        <div className="mx-auto max-w-6xl space-y-4">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-orange-200/70">
                  Room {room.code}
                </p>
                <h1 className="mt-2 text-2xl font-semibold">Lobby</h1>
                <p className="mt-2 text-sm text-slate-400">
                  O‘yinchilar: {players.length} / {room.maxPlayers} • Finish:{" "}
                  {room.winnerTarget} kishi
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                Host: {players.find((player) => player.isHost)?.name}
              </div>
            </div>
          </section>

          {me.isHost ? (
            <section className="rounded-[2rem] border border-sky-300/15 bg-sky-400/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-sky-100/70">
                    Invite
                  </p>
                  <p className="mt-2 text-sm text-slate-200">
                    Odamlar shu linkni bosib, nickname yozib xonaga kiradi.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => void handleCopyInviteLink()}
                    className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Linkni nusxalash
                  </button>
                  <button
                    onClick={() => void handleShareInviteLink()}
                    className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Ulashish
                  </button>
                </div>
              </div>
              <p className="mt-4 break-all rounded-[1rem] border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                {inviteUrl}
              </p>
              {shareFeedback ? (
                <p className="mt-3 text-sm text-sky-100/80">{shareFeedback}</p>
              ) : null}
            </section>
          ) : null}

          {hostControls}

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">O‘yinchilar ro‘yxati</h2>
              <p className="text-sm text-slate-400">Kamida 3 kishi kerak</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => (
                <PlayerCard
                  key={player.id}
                  name={player.name}
                  isHost={player.isHost}
                  isAlive={player.isAlive}
                  revealedCards={{}}
                  isMe={player.id === me.id}
                />
              ))}
            </div>
          </section>

          {error ? (
            <div className="rounded-full border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.14),transparent_24%),linear-gradient(180deg,#050b15_0%,#020617_100%)] px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-orange-200/70">
                Room {room.code}
              </p>
              <h1 className="mt-2 text-2xl font-semibold">
                {room.status === "FINISHED"
                  ? "O‘yin tugadi"
                  : `Round ${Math.max(room.round, 1)}`}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {game.phase === "INTRO"
                  ? "Barcha kasblar ochildi, fojea bilan tanishing."
                  : game.phase === "ROUND_REVEAL"
                    ? `Navbat: ${currentTurnPlayer?.name ?? "noma'lum"}`
                    : game.phase === "ROUND_PITCH"
                      ? `${currentTurnPlayer?.name ?? "o'yinchi"} 2 daqiqalik pitch qilyapti`
                      : game.phase === "ROUND_COMPLETE"
                        ? "Round tugadi. Host keyingi qarorni tanlaydi."
                        : game.phase === "VOTING"
                          ? "Ovoz berish bosqichi"
                          : "Yakuniy natija"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={toggleAudio}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
              >
                {audioEnabled ? "Ovozni o‘chirish" : "Ovoz yoqish"}
              </button>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                {game.phase}
              </div>
              <Timer seconds={game.remainingSeconds} />
            </div>
          </div>
        </section>

        {hostControls}

        {room.status === "FINISHED" ? (
          <section className="rounded-[2rem] border border-emerald-300/15 bg-emerald-500/10 p-5">
            <h2 className="text-xl font-semibold text-white">Yakuniy natija</h2>
            <p className="mt-3 text-sm text-slate-200">
              Yutganlar:{" "}
              {winners.map((player) => player.name).join(", ") ||
                "Hech kim qolmadi"}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/")}
                className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950"
              >
                Bosh sahifaga qaytish
              </button>
            </div>
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Mening kartalarim</h2>
            <div className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">
              {me.isAlive ? "Aktiv" : "Chiqqan"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {myCards.map((card) => (
              <div
                key={card.type}
                className={`rounded-[1rem] border px-4 py-3 ${
                  card.isRevealed
                    ? "border-orange-300/20 bg-orange-500/10"
                    : "border-white/10 bg-slate-950/45"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                    {card.label}
                  </p>
                  {card.isRevealed ? (
                    <div className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                      Ochiq
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-100">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">O‘yinchilar</h2>
            <p className="text-sm text-slate-400">
              Tirik: {alivePlayers.length}
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {otherPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                name={player.name}
                isHost={player.isHost}
                isAlive={player.isAlive}
                revealedCards={player.visibleCards}
                isCurrentTurn={player.id === game.currentTurnPlayerId}
              />
            ))}
          </div>
        </section>

        {error ? (
          <div className="rounded-full border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      {introOpen && game.disaster ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/40">
            <p className="text-[11px] uppercase tracking-[0.35em] text-orange-200/70">
              Fojea
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              {game.disaster.name}
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {game.disaster.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => setIntroOpen(false)}
                className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950"
              >
                Tushundim
              </button>
              {me.isHost ? (
                <button
                  onClick={() => {
                    setIntroOpen(false);
                    emit("start_round");
                  }}
                  className="rounded-full border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white"
                >
                  1-roundni boshlash
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {situationOpen && game.situation ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/40">
            <p className="text-[11px] uppercase tracking-[0.35em] text-sky-200/70">
              Situation
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              Round {game.roundNumber} vaziyati
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {game.situation.text}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                Vaziyat bilan tanishib olgach, roundga kirishingiz mumkin.
              </p>
              <button
                onClick={() => setSituationOpen(false)}
                className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950"
              >
                Roundga kirish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shouldShowRevealModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-sky-300/15 bg-slate-950 p-6 shadow-2xl shadow-black/40">
            <p className="text-[11px] uppercase tracking-[0.35em] text-sky-200/70">
              Sizning navbatingiz
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Bitta kartani oching
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Kartani tanlaganingizdan keyin nega shu kartani ochganingizni 2
              daqiqada tushuntirasiz.
            </p>
            <div className="mt-5 grid gap-3">
              {revealOptions.map((card) => (
                <button
                  key={card.type}
                  onClick={() => emit("reveal_card", { cardType: card.type })}
                  className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-left"
                >
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-2 text-sm text-slate-100">{card.value}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {game.phase === "VOTING" ? (
        <VotePanel
          canVote={canVote}
          hasVoted={roomState.votes.submittedByMe}
          players={players.map((player) => ({
            id: player.id,
            name: player.name,
            isAlive: player.isAlive,
            visibleCards: player.visibleCards,
          }))}
          meId={me.id}
          onVote={(targetPlayerId) => emit("vote", { targetPlayerId })}
        />
      ) : null}

      {announcement ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-slate-950/95 px-5 py-4 shadow-2xl shadow-black/35">
            <p className="text-sm font-semibold text-white">
              {announcement.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {announcement.description}
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
