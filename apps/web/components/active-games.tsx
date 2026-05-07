"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { type LocalizedText } from "@/lib/localized-content";
import { getOrCreateSessionId } from "@/lib/storage";

type ActiveGameItem = {
  playerId: string;
  isHost: boolean;
  isAlive: boolean;
  name: string;
  room: {
    code: string;
    gameType: "BUNKER" | "MAFIA";
    status: "LOBBY" | "PLAYING" | "FINISHED" | "CANCELLED";
    createdAt: string;
    phase: string;
    disasterName: LocalizedText | null;
  };
};

export function ActiveGames() {
  const router = useRouter();
  const { language, t } = useI18n();
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
          "/api/me/active-games",
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
        body: JSON.stringify({ sessionId }),
      });
      const target = (
        item.room.status === "LOBBY"
          ? `/room/${item.room.code}`
          : `/game/${item.room.code}`
      ) as Route;
      router.push(target);
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes("yakunlangan")) {
        setItems((current) =>
          current.filter((it) => it.playerId !== item.playerId),
        );
      } else {
        alert(message);
      }
      setResuming(null);
    }
  }

  if (loading) {
    return (
      <section className="animate-pulse">
        <div className="h-3 w-24 rounded bg-bg-elevated" />
        <ul className="mt-2 grid gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="h-4 w-2/3 rounded bg-bg-elevated" />
                <div className="mt-2 h-3 w-1/2 rounded bg-bg-elevated" />
              </div>
              <div className="h-9 w-20 shrink-0 rounded-xl bg-bg-elevated" />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="grid gap-3">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
        {t("davom_ettirish")}
      </p>
      <ul className="grid gap-3">
        {items.map((it) => (
          <li
            key={it.playerId}
            className="relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/15 via-bg-surface to-bg-surface p-4 shadow-[0_18px_48px_rgba(245,158,11,0.08)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 right-6 h-32 w-32 rounded-full bg-brand/20 blur-3xl"
            />
            <div className="relative min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-brand">
                <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1">
                  {it.room.gameType === "MAFIA" ? "Mafia" : "Bunker"}
                </span>
                <span className="rounded-full border border-line-strong bg-bg-base/70 px-2.5 py-1 font-mono  tracking-[0.35em] text-ink-muted">
                  #{it.room.code}
                </span>
              </div>
              {/* <p className="mt-2 truncate text-lg font-semibold text-ink-primary">
                {(it.room.disasterName
                  ? getLocalizedText(it.room.disasterName, language)
                  : null) ??
                  (it.room.gameType === "MAFIA"
                    ? t("mafia_oyini")
                    : t("bunker_oyini"))}
              </p> */}
              <p className="mt-1 text-sm text-ink-secondary">
                {it.room.status === "LOBBY"
                  ? t("lobbi_kuting")
                  : t("bosqich_phase", { phase: it.room.phase })}
                {it.isHost ? t("siz_host") : ""}
                {!it.isAlive ? t("chiqib_ketgansiz") : ""}
              </p>
            </div>
            <button
              onClick={() => resume(it)}
              disabled={resuming === it.playerId}
              className="inline-flex h-12 min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-base font-semibold text-bg-base shadow-[0_10px_24px_rgba(245,158,11,0.2)] transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-100"
            >
              {resuming === it.playerId ? (
                <>
                  <span className="sr-only">{t("yuklanmoqda")}</span>
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-bg-base/30 border-t-bg-base"
                  />
                </>
              ) : (
                t("davom")
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
