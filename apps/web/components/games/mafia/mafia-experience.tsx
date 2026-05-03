"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { CancelledRoomModal } from "@/components/cancelled-room-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { apiRequest } from "@/lib/api";
import { getAuthToken, getAuthUser } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import { getOrCreateSessionId } from "@/lib/storage";
import { pushToast } from "@/store/useToastStore";

import { MafiaDay } from "./mafia-day";
import { MafiaFinished } from "./mafia-finished";
import { MafiaNight } from "./mafia-night";
import { MafiaNightResult } from "./mafia-night-result";
import { MafiaRoleReveal } from "./mafia-role-reveal";
import type { MafiaPublicState } from "./mafia-types";

type MafiaExperienceProps = {
  roomCode: string;
  view: "room" | "game";
};

// Stage 2: lobby UI is fully wired. The in-game phases (role-reveal,
// night, day discussion, day vote, finished) ship in following
// commits — for now we render a placeholder once room.status flips to
// PLAYING / FINISHED so the host's "Start" still has somewhere to
// land while the rest of the screens are built.
export function MafiaExperience({ roomCode, view }: MafiaExperienceProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<MafiaPublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(true);
  const [endGameConfirmOpen, setEndGameConfirmOpen] = useState(false);
  const [kickTarget, setKickTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [joinName, setJoinName] = useState("");
  const [cancelledModalOpen, setCancelledModalOpen] = useState(false);
  const connectedRef = useRef(false);
  // Tracks which (roomCode, playerId) pairs already saw the cancelled
  // modal so reconnects / state refetches don't keep popping it back.
  const seenCancelledModalRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // Lobby vaqtida host xonani tugatib yuborsa room CANCELLED bo'ladi
  // va o'yin umuman boshlanmaydi. Har bir ishtirokchiga "o'yin
  // yaratilmadi" modal bir marta chiqsin va bosh sahifaga
  // yo'naltirsin. Bunker bilan bir xil pattern.
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

  // Warm the browser cache for every situation banner used during a
  // Mafia round (ghost / victim / doctor save / peaceful night / talk
  // / no-vote / winner banners). By the time the night/day cards
  // animate in, their artwork is already cached locally.
  useEffect(() => {
    const sources = [
      "/ghostimg.webp",
      "/diedimg.webp",
      "/doctorimg.webp",
      "/dayimg.webp",
      "/talkimg.webp",
      "/novoiceimg.webp",
      "/mafiaimg.webp",
      "/cityimg.webp"
    ];
    for (const src of sources) {
      const img = new window.Image();
      img.src = src;
    }
  }, []);

  // Prefill the join nickname from the cached auth profile so the
  // invitee can tap "Roomga kirish" without retyping their name. Same
  // pattern as the Bunker experience.
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

  // Initial state fetch — same pattern as Bunker.
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void (async () => {
      try {
        const data = await apiRequest<MafiaPublicState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
        );
        if (!active) return;
        setRoomState(data);
        setLoading(false);
      } catch (e) {
        if (!active) return;
        setError((e as Error).message);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [roomCode, sessionId]);

  // Auto-route between /room and /game based on room.status — same as
  // Bunker so a host pressing "Start" pulls everyone forward.
  useEffect(() => {
    if (!roomState) return;
    if (view === "room" && roomState.room.status !== "LOBBY") {
      router.replace(`/game/${roomCode}` as Route);
      return;
    }
    if (view === "game" && roomState.room.status === "LOBBY") {
      router.replace(`/room/${roomCode}` as Route);
    }
  }, [roomState, view, roomCode, router]);

  // Socket lifecycle — mirrors Bunker's reconnect-friendly setup.
  useEffect(() => {
    if (!sessionId || connectedRef.current) return;

    const socket = getSocket();
    let isReconnect = false;

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit("join_room", { roomCode, sessionId });
      if (isReconnect) {
        void apiRequest<MafiaPublicState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
        )
          .then((s) => setRoomState(s))
          .catch(() => undefined);
      }
      isReconnect = true;
    };

    const onDisconnect = () => setSocketConnected(false);
    const onState = (s: MafiaPublicState) => {
      setRoomState(s);
      setLoading(false);
    };
    const onErr = ({ message }: { message: string }) => {
      pushToast({ kind: "error", text: message });
      setError(message);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) {
        socket.connect();
      } else {
        void apiRequest<MafiaPublicState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
        )
          .then((s) => setRoomState(s))
          .catch(() => undefined);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_state", onState);
    socket.on("action_error", onErr);
    document.addEventListener("visibilitychange", onVisibility);
    socket.connect();
    connectedRef.current = true;

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_state", onState);
      socket.off("action_error", onErr);
      document.removeEventListener("visibilitychange", onVisibility);
      connectedRef.current = false;
    };
  }, [roomCode, sessionId]);

  function emit(event: string, payload?: Record<string, unknown>) {
    if (!sessionId) return;
    const socket = getSocket();
    socket.emit(event, { roomCode, sessionId, ...(payload ?? {}) });
  }

  // Join handler — mirrors Bunker. Hits the HTTP endpoint, then
  // re-emits join_room over the socket so the room state broadcast
  // reflects the new player immediately for everyone in the lobby.
  async function joinWithName(name: string) {
    if (!sessionId) return;
    await apiRequest(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      body: JSON.stringify({ name, sessionId })
    });
    const socket = getSocket();
    socket.emit("join_room", { roomCode, sessionId });
    const fresh = await apiRequest<MafiaPublicState>(
      `/api/rooms/${roomCode}/state?sessionId=${sessionId}`,
    );
    setRoomState(fresh);
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    try {
      await joinWithName(joinName.trim());
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">
        Yuklanmoqda…
      </div>
    );
  }

  if (error || !roomState) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-bad">
        {error ?? "Xona topilmadi."}
      </div>
    );
  }

  const { room, players, me, game } = roomState;

  // Visitor (link recipient) hasn't joined yet — surface the right
  // call-to-action depending on room status and auth state. Mirrors
  // Bunker's invite flow.
  if (!me) {
    if (room.status !== "LOBBY") {
      const finished =
        room.status === "FINISHED" || room.status === "CANCELLED";
      return (
        <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
          <div className="mx-auto max-w-md pt-6">
            <p
              className={`text-xs font-medium uppercase tracking-wider ${
                finished ? "text-bad" : "text-warn"
              }`}
            >
              {finished ? "Yopiq" : "Boshlangan"}
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {finished
                ? "Bu o'yin yakunlangan"
                : "Bu o'yin allaqachon boshlangan"}
            </h1>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              {finished
                ? "Yangi o'yin yarating yoki ochiq xona kodini so'rang."
                : "O'yin boshlanganidan keyin yangi o'yinchi qo'shila olmaydi."}
            </p>
            <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <p className="text-xs text-ink-muted">Room code</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">
                {roomCode}
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard" as Route)}
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
              Taklif · Mafia
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
            Taklif · Mafia
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

  // Lobby view (room.status === LOBBY)
  if (room.status === "LOBBY") {
    return (
      <>
        <Lobby
          room={room}
          game={game}
          players={players}
          me={me}
          socketConnected={socketConnected}
          onStartGame={() => emit("start_game")}
          onLeaveRoom={() => emit("leave_room")}
          onRequestKickPlayer={(player) => setKickTarget(player)}
          onRequestEndGame={() => setEndGameConfirmOpen(true)}
        />
        <ConfirmModal
          open={endGameConfirmOpen}
          title="Roomni o'chirishni tasdiqlang"
          description="Lobby bekor qilinadi va barcha o'yinchilar chiqib ketadi."
          confirmLabel="Roomni o'chirish"
          tone="danger"
          onConfirm={() => {
            setEndGameConfirmOpen(false);
            emit("end_game");
          }}
          onClose={() => setEndGameConfirmOpen(false)}
        />
        <ConfirmModal
          open={!!kickTarget}
          title={kickTarget ? `${kickTarget.name}ni chiqarish?` : ""}
          description="Bu o'yinchi roomdan chiqarib yuboriladi. Xohlasa, qayta link orqali kirishi mumkin."
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
      </>
    );
  }

  // ASSIGN_ROLES — har o'yinchi rolini ko'radi va tasdiqlaydi. Hamma
  // tasdiqlasa, server o'zi NIGHT fazasiga o'tkazadi.
  if (game.phase === "ASSIGN_ROLES" && room.status === "PLAYING") {
    return (
      <>
        <MafiaRoleReveal
          state={roomState}
          onConfirm={() => emit("mafia:confirm_role")}
        />
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // NIGHT — strict 20s window. Each role taps a target; server
  // resolves at the deadline.
  if (game.phase === "NIGHT" && room.status === "PLAYING") {
    return (
      <>
        <MafiaNight
          state={roomState}
          onSubmit={(action, targetPlayerId) =>
            emit("mafia:submit_night_action", { action, targetPlayerId })
          }
        />
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // NIGHT_RESULT — sequential reveal of victims and doctor save.
  if (game.phase === "NIGHT_RESULT" && room.status === "PLAYING") {
    return (
      <>
        <MafiaNightResult state={roomState} />
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // DAY phases — discussion / vote / tiebreak / result share one
  // component since they're variations of the same shell.
  if (
    (game.phase === "DAY_DISCUSSION" ||
      game.phase === "DAY_VOTE" ||
      game.phase === "DAY_TIEBREAK" ||
      game.phase === "DAY_RESULT") &&
    room.status === "PLAYING"
  ) {
    return (
      <>
        <MafiaDay
          state={roomState}
          onAdvancePhase={() => emit("mafia:advance_phase")}
          onSubmitVote={(targetPlayerId) =>
            emit("mafia:submit_day_vote", { targetPlayerId })
          }
        />
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // Game over — winner banner + role reveal grid. CANCELLED rooms
  // (host nuked the lobby before start) also land here because the
  // service flips game.phase to FINISHED in both endGame branches.
  if (
    game.phase === "FINISHED" ||
    room.status === "FINISHED" ||
    room.status === "CANCELLED"
  ) {
    return (
      <>
        <MafiaFinished state={roomState} />
        <CancelledRoomModal
          open={cancelledModalOpen}
          onDismiss={() => {
            setCancelledModalOpen(false);
            router.push("/dashboard" as Route);
          }}
        />
        {!socketConnected ? <ReconnectingBanner /> : null}
      </>
    );
  }

  // Fallback — should be unreachable because every (status, phase)
  // combination is handled above. Render the dashboard link so the
  // user isn't stuck on a blank screen if a new phase is added.
  return (
    <>
      <main className="min-h-screen bg-bg-base text-ink-primary">
        <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pt-safe sm:px-6 lg:px-8">
          <header className="flex items-center justify-between py-3">
            <p className="text-sm font-semibold">Mafia</p>
            <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 text-xs text-ink-secondary">
              {room.code}
            </span>
          </header>

          <section className="mt-6 grid gap-4 rounded-2xl border border-dashed border-line-strong bg-bg-surface p-6 text-center">
            <p className="text-2xl">🚧</p>
            <p className="text-base font-semibold">Noma'lum holat</p>
            <p className="text-sm text-ink-muted">
              Hozirgi faza: {game.phase}.
            </p>
          </section>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard" as Route)}
              className="flex h-12 items-center justify-center rounded-xl bg-ok text-sm font-semibold text-bg-base"
            >
              Bosh sahifaga qaytish
            </button>
            {me?.isHost ? (
              <button
                type="button"
                onClick={() => setEndGameConfirmOpen(true)}
                className="flex h-12 items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad"
              >
                O'yinni tugatish
              </button>
            ) : null}
          </div>
        </div>
      </main>
      <ConfirmModal
        open={endGameConfirmOpen}
        title="O'yinni tugatishni tasdiqlang"
        description="O'yin to'xtatiladi va barcha o'yinchilar bosh sahifaga qaytadi."
        confirmLabel="Ha, tugatish"
        tone="danger"
        onConfirm={() => {
          setEndGameConfirmOpen(false);
          emit("end_game");
        }}
        onClose={() => setEndGameConfirmOpen(false)}
      />
      {!socketConnected ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 grid place-items-center pt-safe">
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/20 px-3 py-1 text-xs font-medium text-warn shadow-pop backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
            Qayta ulanmoqda…
          </div>
        </div>
      ) : null}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Lobby view
// ─────────────────────────────────────────────────────────────────────

function Lobby({
  room,
  game,
  players,
  me,
  socketConnected,
  onStartGame,
  onLeaveRoom,
  onRequestKickPlayer,
  onRequestEndGame,
}: {
  room: MafiaPublicState["room"];
  game: MafiaPublicState["game"];
  players: MafiaPublicState["players"];
  me: MafiaPublicState["me"];
  socketConnected: boolean;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onRequestKickPlayer: (player: { id: string; name: string }) => void;
  onRequestEndGame: () => void;
}) {
  const router = useRouter();
  const config = game.config;
  const specialRoles =
    config.mafiaCount + (config.hasSheriff ? 1 : 0) + (config.hasDoctor ? 1 : 0);
  const minPlayers = specialRoles + 1;
  const canStart = players.length >= minPlayers;
  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${room.code}`
    : "";
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleCopyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
      pushToast({ kind: "success", text: "Link nusxalandi" });
    } catch {
      pushToast({ kind: "error", text: "Nusxalab bo‘lmadi" });
    }
  }

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary pb-32">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-5 pt-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-3 lg:py-5">
          <button
            type="button"
            onClick={() => router.push("/dashboard" as Route)}
            className="flex items-center gap-1 text-sm font-medium text-ink-secondary"
          >
            ← Bosh sahifa
          </button>
          <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 text-xs">
            Lobby · Mafia
          </span>
        </header>

        {/* Room code card */}
        <section className="mt-2 rounded-3xl border border-line-subtle bg-bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            Room code
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.4em]">
            {room.code}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            {players.length} / {room.maxPlayers} o'yinchi
          </p>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                linkCopied
                  ? "bg-ok text-bg-base"
                  : "bg-brand text-bg-base"
              }`}
            >
              {linkCopied ? "✓ Nusxalandi" : "Linkni nusxalash"}
            </button>
            <p className="break-all rounded-xl bg-bg-base/60 px-3 py-2 text-xs text-ink-muted">
              {inviteUrl}
            </p>
          </div>
        </section>

        {/* Composition preview */}
        <section className="mt-4 rounded-2xl border border-line-subtle bg-bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            Tarkib
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <CompositionChip label="Mafia" value={config.mafiaCount} />
            <CompositionChip
              label="Komisar"
              value={config.hasSheriff ? 1 : 0}
            />
            <CompositionChip
              label="Doktor"
              value={config.hasDoctor ? 1 : 0}
            />
            <CompositionChip
              label="Aholi"
              value={Math.max(0, room.maxPlayers - specialRoles)}
            />
          </div>
        </section>

        {/* Players list */}
        <section className="mt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">O'yinchilar</h2>
            <p className="text-xs text-ink-muted">
              Kamida {minPlayers} kishi · {Math.min(players.length, minPlayers)} ta tayyor
            </p>
          </div>
          <ul className="mt-2 grid gap-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-3"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold uppercase text-brand">
                  {p.name.slice(0, 2)}
                </span>
                <div className="flex-1 leading-tight">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-[11px] text-ink-muted">
                    {me?.id === p.id
                      ? "Siz"
                      : p.online
                        ? "O'yinchi"
                        : "Tarmoqda emas"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    p.online
                      ? "bg-ok/15 text-ok"
                      : "bg-bg-elevated text-ink-muted"
                  }`}
                >
                  ● {p.online ? "Onlayn" : "Offlayn"}
                </span>
                {me?.isHost && p.id !== me.id && room.status === "LOBBY" ? (
                  <button
                    type="button"
                    onClick={() =>
                      onRequestKickPlayer({ id: p.id, name: p.name })
                    }
                    aria-label={`${p.name}ni chiqarish`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bad/40 bg-bad/10 text-bad transition active:scale-95"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {!me?.isHost ? (
          <p className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface px-4 py-3 text-center text-sm text-ink-secondary">
            Host o'yinni boshlashini kuting…
          </p>
        ) : null}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-bg-base/95 px-4 pt-3 pb-safe backdrop-blur">
        <div className="mx-auto max-w-xl">
          {me?.isHost ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onStartGame}
                disabled={!canStart}
                className="flex h-12 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
              >
                {canStart
                  ? "O'yinni boshlash"
                  : `${minPlayers} ta o'yinchi kerak`}
              </button>
              <button
                type="button"
                onClick={onRequestEndGame}
                className="flex h-12 items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad transition"
              >
                Roomni o'chirish
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLeaveRoom}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad"
            >
              Roomdan chiqish
            </button>
          )}
        </div>
      </div>

      {!socketConnected ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 grid place-items-center pt-safe">
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/20 px-3 py-1 text-xs font-medium text-warn shadow-pop backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
            Qayta ulanmoqda…
          </div>
        </div>
      ) : null}
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

function ReconnectingBanner() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 grid place-items-center pt-safe">
      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/20 px-3 py-1 text-xs font-medium text-warn shadow-pop backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
        Qayta ulanmoqda…
      </div>
    </div>
  );
}
