"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getOrCreateSessionId } from "@/lib/storage";

type CreateRoomResponse = {
  roomCode: string;
  playerId: string;
};

export function HomePage() {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [winnerTarget, setWinnerTarget] = useState(2);
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const sessionId = getOrCreateSessionId();
      const response = await apiRequest<CreateRoomResponse>("/api/rooms/create", {
        method: "POST",
        body: JSON.stringify({
          hostName,
          sessionId,
          winnerTarget
        })
      });
      router.push(`/room/${response.roomCode}`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const sessionId = getOrCreateSessionId();
      await apiRequest(`/api/rooms/${joinCode.toUpperCase()}/join`, {
        method: "POST",
        body: JSON.stringify({
          name: joinName,
          sessionId
        })
      });
      router.push(`/room/${joinCode.toUpperCase()}`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_35%),linear-gradient(180deg,#07111f_0%,#020617_100%)] px-4 py-8 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-6 shadow-2xl shadow-orange-950/20 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.4em] text-orange-200/70">
            Bunker Online
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-bold leading-tight sm:text-6xl">
            Real-time, bir joyda o‘ynaladigan psixologik party game.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Host xona yaratadi, odamlar link bilan kiradi, kartalar ochiladi va har round
            oxirida kim bunkerda qolishi kerakligi uchun ovoz beriladi.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              "Public join link",
              "Host tanlaydigan finish sharti",
              "Admin panel orqali kontent boshqaruvi"
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6">
          <form
            onSubmit={handleCreate}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur"
          >
            <h2 className="text-2xl font-semibold">Room yaratish</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm text-slate-300">
                Host nickname
                <input
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  required
                  className="h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white outline-none ring-orange-400/40 transition focus:ring"
                  placeholder="Masalan, Sardor"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                O'yin nechta odam qolganda tugaydi?
                <select
                  value={winnerTarget}
                  onChange={(event) => setWinnerTarget(Number(event.target.value))}
                  className="h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white outline-none"
                >
                  <option value={1}>1 kishi</option>
                  <option value={2}>2 kishi</option>
                  <option value={3}>3 kishi</option>
                </select>
              </label>

              <button
                disabled={loading}
                className="mt-2 h-12 rounded-full bg-orange-500 px-5 text-base font-semibold text-slate-950 disabled:opacity-60"
              >
                Room yaratish
              </button>
            </div>
          </form>

          <form
            onSubmit={handleJoin}
            className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-6"
          >
            <h2 className="text-2xl font-semibold">Roomga qo‘shilish</h2>
            <div className="mt-5 grid gap-4">
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                required
                className="h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 uppercase text-white outline-none"
                placeholder="ROOM CODE"
              />
              <input
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                required
                className="h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white outline-none"
                placeholder="Nickname"
              />
              <button
                disabled={loading}
                className="h-12 rounded-full border border-white/15 bg-white/10 px-5 text-base font-semibold text-white disabled:opacity-60"
              >
                Roomga kirish
              </button>
            </div>
            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          </form>
        </section>
      </div>
    </main>
  );
}
