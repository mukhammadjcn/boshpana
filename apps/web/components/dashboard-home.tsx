"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { ActiveGames } from "@/components/active-games";
import { JoinRoomModal } from "@/components/join-room-modal";
import { apiRequest } from "@/lib/api";
import { type AuthUser, getAuthUser, setAuthUser } from "@/lib/auth";
import { getOrCreateSessionId } from "@/lib/storage";

type UsageResponse = {
  roomsCreatedLast30d: number;
  roomCreationLimit: number;
  remaining: number;
};

const winnerOptions = [
  { value: 1, label: "1 kishi", hint: "Klassik" },
  { value: 2, label: "2 kishi", hint: "Tezroq" },
  { value: 3, label: "3 kishi", hint: "Yumshoq" }
];

export function DashboardHome() {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [hostName, setHostName] = useState("");
  const [winnerTarget, setWinnerTarget] = useState(2);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const cached = getAuthUser();
    setUser(cached);
    const fallback =
      cached?.nickname ??
      cached?.firstName ??
      cached?.telegramUsername ??
      "";
    if (fallback) setHostName((current) => current || fallback);
    let active = true;
    void (async () => {
      try {
        const [meRes, usageRes] = await Promise.all([
          apiRequest<{ user: AuthUser }>("/api/auth/me"),
          apiRequest<UsageResponse>("/api/me/usage")
        ]);
        if (!active) return;
        setUser(meRes.user);
        setAuthUser(meRes.user);
        setUsage(usageRes);
        const next =
          meRes.user.nickname ??
          meRes.user.firstName ??
          meRes.user.telegramUsername ??
          "";
        if (next) setHostName((current) => current || next);
      } catch {
        // keep cached values
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const greeting = user?.nickname ?? user?.firstName ?? "do'stim";
  const limitReached = !!usage && usage.remaining <= 0;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (limitReached) return;
    setCreating(true);
    setCreateError(null);
    try {
      const sessionId = getOrCreateSessionId();
      const response = await apiRequest<{ roomCode: string }>(
        "/api/rooms/create",
        {
          method: "POST",
          body: JSON.stringify({
            hostName: hostName.trim(),
            sessionId,
            winnerTarget
          })
        }
      );
      router.push(`/room/${response.roomCode}` as Route);
    } catch (error) {
      setCreateError((error as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 pt-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-3 lg:py-5">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-base font-bold text-bg-base lg:h-10 lg:w-10">
              B
            </span>
            <div className="leading-tight">
              <p className="text-base font-semibold lg:text-lg">Boshpana</p>
              <p className="text-xs text-ink-muted">Bunker Online</p>
            </div>
          </div>
          <Link
            href={"/dashboard/profile" as Route}
            className="flex items-center gap-2 rounded-full border border-line-strong bg-bg-surface py-1.5 pl-1.5 pr-3 text-sm"
          >
            <Avatar user={user} />
            <span className="max-w-[6rem] truncate text-xs font-medium lg:max-w-none lg:text-sm">
              {user?.nickname ?? user?.firstName ?? "Profil"}
            </span>
          </Link>
        </header>

        <section className="mt-2 flex-1 pb-10 lg:mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            Salom, {greeting}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            Bugun bunkerga kim tushadi?
          </h1>

          <div className="mt-5 grid gap-5 lg:mt-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
            <div className="grid gap-5">
          {!usage ? (
            <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 animate-pulse rounded-full bg-bg-elevated" />
                <div className="h-4 w-12 animate-pulse rounded-full bg-bg-elevated" />
              </div>
              <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-bg-elevated" />
              <div className="mt-3 h-3 w-2/3 animate-pulse rounded-full bg-bg-elevated" />
            </div>
          ) : (
            <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <div className="flex items-center justify-between text-sm">
                <p className="font-semibold text-ink-primary">Oylik limit</p>
                <p
                  className={`text-sm font-mono ${limitReached ? "text-bad" : "text-brand"}`}
                >
                  {usage.remaining}/{usage.roomCreationLimit}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-elevated">
                <div
                  className={`h-full ${limitReached ? "bg-bad" : "bg-brand"}`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((usage.roomCreationLimit - usage.remaining) /
                          usage.roomCreationLimit) *
                          100
                      )
                    )}%`
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                30 kunda {usage.roomCreationLimit} ta o'yin yarata olasiz.{" "}
                {limitReached
                  ? "Limit tugagan — keyingi davrigacha kuting."
                  : `Hozir ${usage.remaining} ta qoldi.`}
              </p>
            </div>
          )}

          <form
            onSubmit={handleCreate}
            className="grid gap-4 rounded-2xl border border-line-subtle bg-bg-surface p-4"
          >
            <label className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                Nickname
              </span>
              <input
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                required
                maxLength={20}
                className="h-12 w-full rounded-xl border border-line-strong bg-bg-base px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
                placeholder="Masalan, Alisher"
              />
            </label>

            <div className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                O'yin nechta odam qolganda tugaydi?
              </span>
              <div className="grid grid-cols-3 gap-2">
                {winnerOptions.map((option) => {
                  const active = winnerTarget === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setWinnerTarget(option.value)}
                      aria-pressed={active}
                      className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                        active
                          ? "border-brand bg-brand-soft text-brand"
                          : "border-line-strong bg-bg-base text-ink-secondary"
                      }`}
                    >
                      <span className="text-sm font-semibold">{option.label}</span>
                      <span className="text-[11px] text-ink-muted">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {createError ? (
              <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                {createError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={creating || limitReached || !hostName.trim()}
              className={`flex h-14 items-center justify-center rounded-xl text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                limitReached
                  ? "bg-bg-elevated text-ink-muted"
                  : "bg-brand text-bg-base"
              }`}
            >
              {creating
                ? "Yaratilmoqda..."
                : limitReached
                  ? "Limit tugagan"
                  : "O'yin yaratish"}
            </button>
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="flex h-12 items-center justify-center rounded-xl border border-line-strong bg-bg-base text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
            >
              Roomga qo'shilish
            </button>
          </form>
            </div>

            <div className="grid gap-5 lg:sticky lg:top-24">
              <ActiveGames />
            </div>
          </div>
        </section>
      </div>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </main>
  );
}

function Avatar({ user }: { user: AuthUser | null }) {
  if (user?.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.photoUrl}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = (user?.nickname ?? user?.firstName ?? "?")
    .slice(0, 1)
    .toUpperCase();
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
      {initial}
    </span>
  );
}
