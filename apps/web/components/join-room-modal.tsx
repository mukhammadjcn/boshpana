"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { getOrCreateSessionId } from "@/lib/storage";

type JoinRoomModalProps = {
  open: boolean;
  onClose: () => void;
  defaultCode?: string;
};

export function JoinRoomModal({ open, onClose, defaultCode = "" }: JoinRoomModalProps) {
  const router = useRouter();
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState(defaultCode);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setJoinCode(defaultCode.toUpperCase());
      setError(null);
    }
  }, [defaultCode, open]);

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoinLoading(true);
    setError(null);

    try {
      const sessionId = getOrCreateSessionId();
      const roomCode = joinCode.toUpperCase();

      await apiRequest(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        body: JSON.stringify({
          name: joinName,
          sessionId
        })
      });

      onClose();
      router.push(`/room/${roomCode}`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setJoinLoading(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <form
        onSubmit={handleJoin}
        className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,15,30,0.98),rgba(2,6,23,0.98))] p-6 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">Join game</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Roomga qo‘shilish</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Link bo‘lsa room avtomatik tanlanadi, siz faqat nickname yozasiz.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300"
          >
            Yopish
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            required
            className="h-14 rounded-[1.25rem] border border-white/10 bg-slate-950/75 px-4 uppercase text-white outline-none"
            placeholder="ROOM CODE"
          />
          <input
            value={joinName}
            onChange={(event) => setJoinName(event.target.value)}
            required
            className="h-14 rounded-[1.25rem] border border-white/10 bg-slate-950/75 px-4 text-white outline-none"
            placeholder="Nickname"
          />
          <button
            disabled={joinLoading}
            className="h-14 rounded-full bg-sky-400 px-5 text-base font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-60"
          >
            {joinLoading ? "Kirilmoqda..." : "Roomga kirish"}
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </form>
    </div>
  );
}
