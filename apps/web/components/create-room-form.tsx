"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { getOrCreateSessionId } from "@/lib/storage";

type CreateRoomResponse = {
  roomCode: string;
};

type CreateRoomFormProps = {
  onOpenJoin: () => void;
};

export function CreateRoomForm({ onOpenJoin }: CreateRoomFormProps) {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [winnerTarget, setWinnerTarget] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateLoading(true);
    setError(null);

    try {
      const sessionId = getOrCreateSessionId();
      const response = await apiRequest<CreateRoomResponse>(
        "/api/rooms/create",
        {
          method: "POST",
          body: JSON.stringify({
            hostName,
            sessionId,
            winnerTarget,
          }),
        },
      );

      router.push(`/room/${response.roomCode}`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-6 shadow-2xl shadow-black/20"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-orange-200/70">
            Create room
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Yangi o‘yin yaratish
          </h2>
        </div>
        {/* <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-3 py-2 text-right">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Flow</p>
          <p className="mt-1 text-sm text-slate-200">Create → Share → Start</p>
        </div> */}
      </div>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm text-slate-300">
          Host nickname
          <input
            value={hostName}
            onChange={(event) => setHostName(event.target.value)}
            required
            className="h-14 rounded-[1.2rem] border border-white/10 bg-slate-950/75 px-4 text-base text-white outline-none ring-orange-400/30 transition focus:ring"
            placeholder="Masalan, Alisher"
          />
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          O‘yin nechta odam qolganda tugaydi?
          <select
            value={winnerTarget}
            onChange={(event) => setWinnerTarget(Number(event.target.value))}
            className="h-14 rounded-[1.2rem] border border-white/10 bg-slate-950/75 px-4 text-base text-white outline-none"
          >
            <option value={1}>1 kishi</option>
            <option value={2}>2 kishi</option>
            <option value={3}>3 kishi</option>
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-3">
        <button
          disabled={createLoading}
          className="h-14 rounded-full bg-orange-500 px-5 text-base font-semibold text-slate-950 transition hover:bg-orange-400 disabled:opacity-60"
        >
          {createLoading ? "Yaratilmoqda..." : "Room yaratish"}
        </button>
        <button
          type="button"
          onClick={onOpenJoin}
          className="h-14 rounded-full border border-white/15 bg-white/8 px-5 text-base font-semibold text-white transition hover:bg-white/12"
        >
          O‘yinga qo‘shilish
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </form>
  );
}
