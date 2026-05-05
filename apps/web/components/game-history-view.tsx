"use client";

import { useEffect, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { apiRequest } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type Outcome = "HOSTED" | "WON" | "ELIMINATED" | "PLAYED" | "CANCELLED";

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
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const outcomeStyles: Record<Outcome, string> = {
  WON: "bg-ok/15 text-ok border-ok/30",
  ELIMINATED: "bg-bg-elevated text-ink-secondary border-line-strong",
  HOSTED: "bg-bg-elevated text-ink-secondary border-line-strong",
  PLAYED: "bg-bg-elevated text-ink-secondary border-line-strong",
  CANCELLED: "bg-bad/10 text-bad border-bad/30"
};

const PAGE_SIZE = 10;

function formatDate(iso: string, language: string) {
  const d = new Date(iso);
  const locale =
    language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ";
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function GameHistoryView() {
  const { language, t } = useI18n();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
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
        setLoading(true);
        const res = await apiRequest<HistoryResponse>(
          `/api/me/games?page=${page}&pageSize=${PAGE_SIZE}`
        );
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authReady, page]);

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const outcomeLabel: Record<Outcome, string> = {
    WON: t("G'olib"),
    ELIMINATED: t("Yakunlangan"),
    HOSTED: t("Yakunlangan"),
    PLAYED: t("Yakunlangan"),
    CANCELLED: t("Bekor qilingan")
  };
  const outcomeNote: Record<Outcome, string | null> = {
    WON: null,
    ELIMINATED: t("Siz chiqib ketgan"),
    HOSTED: t("Qo'lda tugatildi"),
    PLAYED: null,
    CANCELLED: t("O'yin boshlanmagan")
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pt-safe pb-safe">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-brand">
          {t("Tarix")}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{t("Mening o'yinlarim")}</h1>
      </header>

      <p className="mt-2 text-sm text-ink-secondary">
        {t(
          "Tugagan o'yinlaringiz tarixi. Faqat sana va falokat saqlanadi — kartalar, ovozlar va boshqa ma'lumotlar avtomatik tozalanadi."
        )}
      </p>

      <section className="mt-6">
        {!authReady ? (
          <div className="rounded-2xl border border-line-subtle bg-bg-surface p-5 text-sm text-ink-secondary">
            {t("Tarixni ko'rish uchun avval Telegram orqali tizimga kiring.")}
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
            {t("Hozircha tugagan o'yin yo'q.")}
          </div>
        ) : (
          <ul className="grid gap-3">
            {items.map((it) => {
              const isCancelled = it.outcome === "CANCELLED";
              const title =
                it.disasterName ??
                (isCancelled
                  ? t("O'yin yaratilmagan")
                  : t("Falokat noma'lum"));
              return (
                <li
                  key={it.id}
                  className="rounded-2xl border border-line-subtle bg-bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                        {formatDate(it.playedAt, language)}
                      </p>
                      <p
                        className={`mt-1 truncate text-base font-semibold ${
                          isCancelled ? "text-ink-secondary" : ""
                        }`}
                      >
                        {title}
                      </p>
                      <p className="mt-1 text-xs text-ink-secondary">
                        {it.roomCode
                          ? t("Xona: {code}", { code: it.roomCode })
                          : null}
                        {it.roomCode && it.playerCount ? " · " : null}
                        {it.playerCount
                          ? t("{count} o'yinchi", { count: it.playerCount })
                          : null}
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
              );
            })}
          </ul>
        )}

        {!loading && !error && totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line-subtle bg-bg-surface px-3 py-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong bg-bg-elevated text-sm disabled:opacity-40"
              aria-label={t("Oldingi sahifa")}
            >
              ←
            </button>
            <p className="text-xs text-ink-muted">
              {t("{page} / {totalPages} · jami {total}", {
                page,
                totalPages,
                total
              })}
            </p>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!canNext}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong bg-bg-elevated text-sm disabled:opacity-40"
              aria-label={t("Keyingi sahifa")}
            >
              →
            </button>
          </div>
        ) : null}
      </section>
      <BottomNav />
    </main>
  );
}
