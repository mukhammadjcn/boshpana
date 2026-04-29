"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

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
  SKILL: "Skill",
  BAGGAGE: "Bagaj",
  FACT: "Fakt"
};

type RoomExperienceProps = {
  roomCode: string;
  view: "room" | "game";
};

export function RoomExperience({ roomCode, view }: RoomExperienceProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(true);
  const store = useGameStore();
  const connectedRef = useRef(false);

  useEffect(() => {
    const currentSessionId = getOrCreateSessionId();
    setSessionId(currentSessionId);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let active = true;

    async function loadState() {
      try {
        const state = await apiRequest<RoomState>(
          `/api/rooms/${roomCode}/state?sessionId=${sessionId}`
        );

        if (active) {
          store.setRoomState(state);
        }
      } catch (error) {
        if (active) {
          store.setError((error as Error).message);
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
  }, [roomCode, sessionId, store]);

  useEffect(() => {
    if (!sessionId || connectedRef.current) {
      return;
    }

    const socket = getSocket();

    socket.connect();
    socket.emit("join_room", { roomCode, sessionId });

    const roomStateHandler = (nextState: RoomState) => {
      store.setRoomState(nextState);
      setLoading(false);
    };

    const timerHandler = ({ remainingSeconds }: { remainingSeconds: number }) => {
      store.patchTimer(remainingSeconds);
    };

    const errorHandler = ({ message }: { message: string }) => {
      store.setError(message);
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
  }, [roomCode, sessionId, store]);

  useEffect(() => {
    if (!store.roomState) {
      return;
    }

    if (view === "room" && store.roomState.room.status !== "LOBBY") {
      router.replace(`/game/${roomCode}`);
    }

    if (view === "game" && store.roomState.room.status === "LOBBY") {
      router.replace(`/room/${roomCode}`);
    }
  }, [roomCode, router, store.roomState, view]);

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await apiRequest(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        body: JSON.stringify({
          name: joinName,
          sessionId
        })
      });

      const socket = getSocket();
      socket.emit("join_room", { roomCode, sessionId });
      const state = await apiRequest<RoomState>(`/api/rooms/${roomCode}/state?sessionId=${sessionId}`);
      store.setRoomState(state);
    } catch (error) {
      store.setError((error as Error).message);
    }
  }

  function emit(event: string, payload?: Record<string, unknown>) {
    const socket = getSocket();
    socket.emit(event, {
      roomCode,
      sessionId,
      ...(payload ?? {})
    });
  }

  const roomState = store.roomState;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Room yuklanmoqda...
      </main>
    );
  }

  if (!roomState?.me) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#08111f_0%,#020617_100%)] px-4 py-10 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-orange-200/70">
            Room {roomCode}
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Qo‘shilish uchun nickname kiriting</h1>
          <form onSubmit={handleJoin} className="mt-6 grid gap-4">
            <input
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
              required
              className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none"
              placeholder="Nickname"
            />
            <button className="h-12 rounded-full bg-orange-500 font-semibold text-slate-950">
              Roomga kirish
            </button>
          </form>
          {store.error ? <p className="mt-4 text-sm text-red-300">{store.error}</p> : null}
        </div>
      </main>
    );
  }

  const canReveal =
    roomState.game.phase === "REVEAL" &&
    roomState.me.isAlive &&
    roomState.me.revealed.length < roomState.game.roundNumber;
  const canVote = roomState.game.phase === "VOTING" && roomState.me.isAlive;
  const aliveCount = roomState.players.filter((player) => player.isAlive).length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.18),transparent_28%),linear-gradient(180deg,#050b15_0%,#020617_100%)] px-4 py-5 text-white">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/45 p-5 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-orange-200/70">
                Room {roomState.room.code}
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                {view === "room" ? "Lobby" : "O‘yin jarayoni"}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Tirik o‘yinchilar: {aliveCount} • Finish sharti: {roomState.room.winnerTarget} kishi
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                Phase: {roomState.game.phase}
              </div>
              <Timer seconds={roomState.game.remainingSeconds} />
            </div>
          </div>

          {roomState.game.disaster ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.5rem] border border-orange-300/15 bg-orange-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-orange-100/70">
                  Disaster
                </p>
                <p className="mt-2 text-xl font-semibold text-orange-50">
                  {roomState.game.disaster.name}
                </p>
                <p className="mt-2 text-sm leading-6 text-orange-100/80">
                  {roomState.game.disaster.description}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Situation</p>
                <p className="mt-2 text-base leading-6 text-slate-100">
                  {roomState.game.situation?.text ?? "Situation hali tanlanmagan"}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <HostControls
          isHost={roomState.me.isHost}
          roomStatus={roomState.room.status}
          phase={roomState.game.phase}
          canStart={roomState.players.length >= 3}
          onStart={() => emit("start_game")}
          onNextPhase={() => emit("next_phase")}
        />

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">Mening kartalarim</h2>
                <div className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-400">
                  {roomState.me.isAlive ? "Aktiv" : "Eliminated"}
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {(Object.entries(roomState.me.cards) as Array<[CardType, string]>).map(
                  ([key, value]) => {
                    const isRevealed = roomState.me?.revealed.includes(key);
                    return (
                      <div
                        key={key}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                              {cardLabels[key]}
                            </p>
                            <p className="mt-2 text-base text-slate-100">
                              {isRevealed ? value : "Yashirin"}
                            </p>
                          </div>
                          <button
                            disabled={!canReveal || isRevealed}
                            onClick={() => emit("reveal_card", { cardType: key })}
                            className="min-w-[120px] rounded-full border border-orange-300/30 bg-orange-500/15 px-4 py-2 text-sm font-semibold text-orange-50 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                          >
                            {isRevealed ? "Ochilgan" : "Ochish"}
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            <VotePanel
              canVote={canVote}
              hasVoted={roomState.votes.submittedByMe}
              players={roomState.players}
              meId={roomState.me.id}
              onVote={(targetPlayerId) => emit("vote", { targetPlayerId })}
            />
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {roomState.players.map((player) => (
                <PlayerCard
                  key={player.id}
                  name={player.name}
                  isHost={player.isHost}
                  isAlive={player.isAlive}
                  revealedCards={player.revealedCards}
                  isMe={player.id === roomState.me?.id}
                />
              ))}
            </div>
          </div>
        </section>

        {store.error ? (
          <div className="rounded-full border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {store.error}
          </div>
        ) : null}
      </div>
    </main>
  );
}
