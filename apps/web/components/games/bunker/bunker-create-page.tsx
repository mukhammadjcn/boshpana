"use client";

import type { Route } from "next";
import { TelegramChrome } from "@/components/telegram-chrome";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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
  { value: 3, label: "3 kishi", hint: "Yumshoq" },
];

const rules = [
  "Har bir o'yinchiga maxfiy karta — kasb, sog'lik, xarakter, ko'nikma, bagaj va fakt — beriladi.",
  "Apokalipsis sodir bo'ladi va guruh boshpana topadi. Faqat cheklangan o'rin bor.",
  "Raundma-raund o'yinchilar kartalarini ochib, o'zlarini muhim ekanini isbotlaydi.",
  "Ovoz berish orqali kim boshpanaga kirmasligini hal qilasiz. Oxirigacha qolganlar — g'olib.",
];

export function BunkerCreatePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [hostName, setHostName] = useState("");
  const [winnerTarget, setWinnerTarget] = useState(2);
  const [isAdult, setIsAdult] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    const cached = getAuthUser();
    setUser(cached);
    const fallback =
      cached?.nickname ?? cached?.firstName ?? cached?.telegramUsername ?? "";
    if (fallback) setHostName((current) => current || fallback);
    let active = true;
    void (async () => {
      try {
        const [meRes, usageRes] = await Promise.all([
          apiRequest<{ user: AuthUser }>("/api/auth/me"),
          apiRequest<UsageResponse>("/api/me/usage"),
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

  const limitReached = !!usage && usage.remaining <= 0;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (limitReached) return;
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
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
            winnerTarget,
            isAdult,
          }),
        },
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
      <TelegramChrome backHref="/dashboard" />
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pt-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-3 lg:py-5">
          <Link
            href={"/dashboard" as Route}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line-strong bg-bg-surface text-ink-secondary"
            aria-label="Orqaga"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            Apokalipsis stol o'yini
          </p>
          <span className="h-9 w-9" />
        </header>

        <section className="mt-2 flex-1 pb-10 lg:mt-6">
          {/* Game banner — same artwork as the dashboard card so the
              detail page feels like a continuation, not a separate
              context. Aspect ratio kept landscape for desktop weight. */}
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-line-subtle bg-bg-surface">
            <Image
              src="/bunkerbanner.webp"
              alt="Bunker banner"
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-bg-base/10 to-transparent" />
          </div>

          <h1 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            Bunker — kim omon qoladi?
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            3-16 o'yinchi · 30-60 daqiqa
          </p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              Qoidalar
            </p>
            <ul className="grid gap-2 text-sm text-ink-secondary">
              {rules.map((rule, index) => (
                <li key={index} className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                    {index + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {usage && (
            <div className="mt-4 rounded-2xl border border-line-subtle bg-bg-surface p-4">
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
                          100,
                      ),
                    )}%`,
                  }}
                />
              </div>
              {limitReached && (
                <p className="mt-2 text-xs text-bad">
                  Limit tugagan — keyingi davrigacha kuting.
                </p>
              )}
            </div>
          )}

          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-4 rounded-2xl border border-line-subtle bg-bg-surface p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              Yangi lobby
            </p>

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
                      <span className="text-sm font-semibold">
                        {option.label}
                      </span>
                      <span className="text-[11px] text-ink-muted">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                Mavzu
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdult(false)}
                  aria-pressed={!isAdult}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                    !isAdult
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line-strong bg-bg-base text-ink-secondary"
                  }`}
                >
                  <span className="text-sm font-semibold">Normal</span>
                  <span className="text-[11px] text-ink-muted">
                    Hamma uchun
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdult(true)}
                  aria-pressed={isAdult}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                    isAdult
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line-strong bg-bg-base text-ink-secondary"
                  }`}
                >
                  <span className="text-sm font-semibold">18+</span>
                  <span className="text-[11px] text-ink-muted">
                    Aralash kartalar
                  </span>
                </button>
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
          </form>

          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-line-strong bg-bg-surface text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
          >
            Kod orqali qo'shilish
          </button>
        </section>
      </div>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </main>
  );
}
