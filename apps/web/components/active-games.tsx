"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { getOrCreateSessionId } from "@/lib/storage";

type ActiveGameItem = {
  playerId: string;
  isHost: boolean;
  isAlive: boolean;
  name: string;
  room: {
    code: string;
    status: "LOBBY" | "PLAYING" | "FINISHED" | "CANCELLED";
    createdAt: string;
    phase: string;
    disasterName: string | null;
  };
};

export function ActiveGames() {
  const router = useRouter();
  const [items, setItems] = useState<ActiveGameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState<string | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await apiRequest<{ items: ActiveGameItem[] }>(
          "/api/me/active-games"
        );
        if (!active) return;
        setItems(res.items);
      } catch {
        // silently — most users won't have active games
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function resume(item: ActiveGameItem) {
    setResuming(item.playerId);
    try {
      const sessionId = getOrCreateSessionId();
      await apiRequest(`/api/rooms/${item.room.code}/resume`, {
        method: "POST",
        body: JSON.stringify({ sessionId })
      });
      const target = (
        item.room.status === "LOBBY"
          ? `/room/${item.room.code}`
          : `/game/${item.room.code}`
      ) as Route;
      router.push(target);
    } catch (error) {
      alert((error as Error).message);
      setResuming(null);
    }
  }

  if (loading) {
    return (
      <section>
        <div className="h-3 w-24 animate-pulse rounded-full bg-bg-elevated" />
        <ul className="mt-2 grid gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-bg-elevated" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-bg-elevated" />
              </div>
              <div className="h-9 w-20 shrink-0 animate-pulse rounded-xl bg-bg-elevated" />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section>
      <p className="text-xs font-medium uppercase tracking-wider text-brand">
        Davom ettirish
      </p>
      <ul className="mt-2 grid gap-2">
        {items.map((it) => (
          <li
            key={it.playerId}
            className="flex items-center justify-between gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {it.room.disasterName ?? "Yangi o'yin"}{" "}
                <span className="text-ink-muted">· {it.room.code}</span>
              </p>
              <p className="text-xs text-ink-secondary">
                {it.room.status === "LOBBY"
                  ? "Lobbi — kuting"
                  : `Bosqich: ${it.room.phase}`}
                {it.isHost ? " · siz host" : ""}
                {!it.isAlive ? " · chiqib ketgansiz" : ""}
              </p>
            </div>
            <button
              onClick={() => resume(it)}
              disabled={resuming === it.playerId}
              className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-bg-base disabled:opacity-50"
            >
              {resuming === it.playerId ? "..." : "Davom"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
