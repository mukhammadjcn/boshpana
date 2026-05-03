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

const rules = [
  "Har o'yinchi maxfiy rol oladi: oddiy aholi, mafia, komisar yoki doktor.",
  "Tunda mafia birga nishon tanlaydi, komisar tekshiradi/otadi, doktor davolaydi.",
  "Kunduzi hamma muhokama qiladi va shubhalini ovoz orqali chetlatadi.",
  "Mafia tirik aholi bilan teng yoki ko'p bo'lsa — ular g'olib. Aksincha — shahar.",
];

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 16;

export function MafiaCreatePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [hostName, setHostName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [mafiaCount, setMafiaCount] = useState(2);
  const [hasSheriff, setHasSheriff] = useState(true);
  const [hasDoctor, setHasDoctor] = useState(true);
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

  // Tarkib hisobi: mafia + sheriff + doctor + aholi = jami. Aholini
  // foydalanuvchi to'g'ridan to'g'ri tanlamaydi — host komponentlari
  // (mafia/sheriff/doctor) ni va jami o'yinchi sonini belgilaydi, qolgan
  // o'rinlar avtomatik ravishda oddiy aholi bo'ladi.
  const specialRoleCount =
    mafiaCount + (hasSheriff ? 1 : 0) + (hasDoctor ? 1 : 0);
  const citizenCount = Math.max(0, maxPlayers - specialRoleCount);
  const compositionValid = citizenCount >= 1;
  const maxMafiaForSize = Math.max(1, Math.floor(maxPlayers / 2));

  // Foydalanuvchi maxPlayers'ni qisqartirsa, mafia soni avtomatik
  // pasaytiriladi (yangi yuqori chegaradan oshib ketmasligi uchun).
  useEffect(() => {
    setMafiaCount((c) => Math.min(c, maxMafiaForSize));
  }, [maxMafiaForSize]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (limitReached || !compositionValid) return;
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
            gameType: "MAFIA",
            hostName: hostName.trim(),
            sessionId,
            maxPlayers,
            mafiaCount,
            hasSheriff,
            hasDoctor,
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
            Kun va tun mafiya
          </p>
          <span className="h-9 w-9" />
        </header>

        <section className="mt-2 flex-1 pb-10 lg:mt-6">
          {/* Game banner — shares artwork with the dashboard card so
              the detail page reads as a continuation of the same
              entry. Landscape ratio gives desktop visual weight. */}
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-line-subtle bg-bg-surface">
            <Image
              src="/mafiabanner.webp"
              alt="Mafia banner"
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-bg-base/10 to-transparent" />
          </div>

          <h1 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            Mafia — kim xiyonatkor?
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            {MIN_PLAYERS}-{MAX_PLAYERS} o'yinchi · 30-45 daqiqa
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
              Yangi o'yin
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Maks o'yinchi
                </span>
                <span className="font-mono text-sm text-brand">
                  {maxPlayers}
                </span>
              </div>
              <input
                type="range"
                min={MIN_PLAYERS}
                max={MAX_PLAYERS}
                step={1}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-brand"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Mafia soni
                </span>
                <span className="font-mono text-sm text-brand">
                  {mafiaCount}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={maxMafiaForSize}
                step={1}
                value={mafiaCount}
                onChange={(e) => setMafiaCount(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-brand"
              />
            </div>

            <div className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                Maxsus rollar
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHasSheriff((v) => !v)}
                  aria-pressed={hasSheriff}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                    hasSheriff
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line-strong bg-bg-base text-ink-secondary"
                  }`}
                >
                  <span className="text-sm font-semibold">Komisar</span>
                  <span className="text-[11px] text-ink-muted">
                    {hasSheriff ? "Bor" : "Yo'q"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setHasDoctor((v) => !v)}
                  aria-pressed={hasDoctor}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                    hasDoctor
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line-strong bg-bg-base text-ink-secondary"
                  }`}
                >
                  <span className="text-sm font-semibold">Doktor</span>
                  <span className="text-[11px] text-ink-muted">
                    {hasDoctor ? "Bor" : "Yo'q"}
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-line-strong bg-bg-base px-3 py-2.5 text-xs text-ink-muted">
              Tarkib: <span className="font-semibold text-ink-primary">{citizenCount}</span>{" "}
              fuqaro · <span className="font-semibold text-ink-primary">{mafiaCount}</span>{" "}
              mafia
              {hasSheriff && <> · 1 komisar</>}
              {hasDoctor && <> · 1 doktor</>}
            </div>

            {!compositionValid && (
              <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
                Tarkib noto'g'ri: kamida 1 ta oddiy aholi qoladigan qilib
                sozlang.
              </p>
            )}

            {createError ? (
              <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                {createError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                creating ||
                limitReached ||
                !compositionValid ||
                !hostName.trim()
              }
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
