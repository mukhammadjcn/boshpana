"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

type Outcome = "HOSTED" | "WON" | "ELIMINATED" | "PLAYED";

type HistoryItem = {
  id: string;
  playedAt: string;
  disasterName: string | null;
  outcome: Outcome;
  roomCode: string | null;
  playerCount: number | null;
};

type HistoryResponse = {
  items: HistoryItem[];
  nextCursor: string | null;
};

const outcomeLabel: Record<Outcome, string> = {
  WON: "G‘alaba",
  ELIMINATED: "Chiqib ketgan",
  HOSTED: "Yakunlangan",
  PLAYED: "O‘ynagan"
};

const outcomeStyles: Record<Outcome, string> = {
  WON: "bg-ok/15 text-ok border-ok/30",
  ELIMINATED: "bg-bad/15 text-bad border-bad/30",
  HOSTED: "bg-warn/15 text-warn border-warn/30",
  PLAYED: "bg-bg-elevated text-ink-secondary border-line-strong"
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function GameHistoryView() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setAuthReady(!!getAuthToken());
  }, []);

  useEffect(() => {
    if (!authReady) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await apiRequest<HistoryResponse>("/api/me/games?limit=20");
        if (!active) return;
        setItems(res.items);
        setNextCursor(res.nextCursor);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authReady]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiRequest<HistoryResponse>(
        `/api/me/games?limit=20&cursor=${encodeURIComponent(nextCursor)}`
      );
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pt-6 pb-safe">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-brand">
            Profil
          </p>
          <h1 className="mt-1 text-2xl font-bold">Mening o‘yinlarim</h1>
        </div>
        <Link
          href="/"
          className="rounded-full border border-line-strong bg-bg-elevated px-3 py-1.5 text-xs font-medium text-ink-secondary"
        >
          Bosh sahifa
        </Link>
      </header>

      <p className="mt-2 text-sm text-ink-secondary">
        Tugagan o‘yinlaringiz tarixi. Faqat sana va falokat saqlanadi —
        kartalar, ovozlar va boshqa ma‘lumotlar avtomatik tozalanadi.
      </p>

      <section className="mt-6">
        {!authReady ? (
          <div className="rounded-2xl border border-line-subtle bg-bg-surface p-5 text-sm text-ink-secondary">
            Tarixni ko‘rish uchun avval Telegram orqali tizimga kiring.
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-line-subtle bg-bg-surface p-5 text-sm text-ink-secondary">
            Yuklanmoqda...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-bad/40 bg-bad/10 p-5 text-sm text-bad">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-line-subtle bg-bg-surface p-5 text-sm text-ink-secondary">
            Hozircha tugagan o‘yin yo‘q.
          </div>
        ) : (
          <ul className="grid gap-3">
            {items.map((it) => (
              <li
                key={it.id}
                className="rounded-2xl border border-line-subtle bg-bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                      {formatDate(it.playedAt)}
                    </p>
                    <p className="mt-1 truncate text-base font-semibold">
                      {it.disasterName ?? "Falokat noma'lum"}
                    </p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {it.roomCode ? `Xona: ${it.roomCode}` : null}
                      {it.roomCode && it.playerCount ? " · " : null}
                      {it.playerCount ? `${it.playerCount} o‘yinchi` : null}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${outcomeStyles[it.outcome]}`}
                  >
                    {outcomeLabel[it.outcome]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {nextCursor ? (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-elevated text-sm font-semibold disabled:opacity-50"
          >
            {loadingMore ? "Yuklanmoqda..." : "Ko‘proq yuklash"}
          </button>
        ) : null}
      </section>
    </main>
  );
}
