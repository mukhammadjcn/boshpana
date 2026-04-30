"use client";

import { useEffect, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
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
  WON: "G‘olib",
  ELIMINATED: "Yakunlangan",
  HOSTED: "Yakunlangan",
  PLAYED: "Yakunlangan"
};

// Sub-label clarifies the nuance under the badge when relevant. For host
// games where the host was voted out the game still ended naturally — we
// note that they didn't survive but don't paint the whole row red.
const outcomeNote: Record<Outcome, string | null> = {
  WON: null,
  ELIMINATED: "Siz chiqib ketgan",
  HOSTED: "Qo‘lda tugatildi",
  PLAYED: null
};

const outcomeStyles: Record<Outcome, string> = {
  WON: "bg-ok/15 text-ok border-ok/30",
  ELIMINATED: "bg-bg-elevated text-ink-secondary border-line-strong",
  HOSTED: "bg-bg-elevated text-ink-secondary border-line-strong",
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
    <main className="mx-auto min-h-screen max-w-xl px-4 pt-safe pb-safe">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-brand">
          Tarix
        </p>
        <h1 className="mt-1 text-2xl font-bold">Mening o‘yinlarim</h1>
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
          <ul className="grid animate-pulse gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="rounded-2xl border border-line-subtle bg-bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="h-3 w-28 rounded bg-bg-elevated" />
                    <div className="mt-2 h-5 w-3/4 rounded bg-bg-elevated" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-bg-elevated" />
                  </div>
                  <div className="h-6 w-20 shrink-0 rounded-full bg-bg-elevated" />
                </div>
              </li>
            ))}
          </ul>
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${outcomeStyles[it.outcome]}`}
                    >
                      {outcomeLabel[it.outcome]}
                    </span>
                    {outcomeNote[it.outcome] ? (
                      <span className="text-[10px] text-ink-muted">
                        {outcomeNote[it.outcome]}
                      </span>
                    ) : null}
                  </div>
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
      <BottomNav />
    </main>
  );
}
