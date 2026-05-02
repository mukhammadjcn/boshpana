"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ConfirmModal } from "@/components/confirm-modal";
import { apiRequest } from "@/lib/api";
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
  const connectedRef = useRef(false);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
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
          onKickPlayer={(targetPlayerId) =>
            emit("kick_player", { targetPlayerId })
          }
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

  // Game over — winner banner + role reveal grid.
  if (game.phase === "FINISHED" || room.status === "FINISHED") {
    return (
      <>
        <MafiaFinished state={roomState} />
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
  onKickPlayer,
  onRequestEndGame,
}: {
  room: MafiaPublicState["room"];
  game: MafiaPublicState["game"];
  players: MafiaPublicState["players"];
  me: MafiaPublicState["me"];
  socketConnected: boolean;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onKickPlayer: (id: string) => void;
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
                    onClick={() => onKickPlayer(p.id)}
                    className="text-[11px] font-medium text-bad hover:underline"
                  >
                    Kick
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
