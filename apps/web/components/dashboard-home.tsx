"use client";

import type { Route } from "next";
import { BrandMark } from "@/components/brand-mark";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { JoinRoomModal } from "@/components/join-room-modal";
import { apiRequest } from "@/lib/api";
import { type AuthUser, getAuthUser, setAuthUser } from "@/lib/auth";
import { ActiveGames } from "./active-games";

type UsageResponse = {
  roomsCreatedLast30d: number;
  roomCreationLimit: number;
  remaining: number;
};

type GameCard = {
  href: Route;
  title: string;
  subtitle: string;
  players: string;
  // Tailwind gradient classes used as a placeholder backdrop until the
  // real landscape art is wired up (replace with <Image> later).
  gradient: string;
  available: boolean;
  image: string;
};

const games: GameCard[] = [
  {
    href: "/dashboard/create/bunker" as Route,
    title: "Bunker",
    subtitle: "Apokalipsis stol o'yini — kim omon qoladi?",
    players: "3-16 kishi · 30-60 daqiqa",
    gradient: "from-amber-700 via-orange-900 to-stone-950",
    available: true,
    image: "/bunkerbanner.webp",
  },
  {
    href: "/dashboard/create/mafia" as Route,
    title: "Mafia",
    subtitle: "Kun va tun — xiyonatkorni toping",
    players: "4-16 kishi · 30-45 daqiqa",
    gradient: "from-violet-800 via-slate-900 to-zinc-950",
    available: true,
    image: "/mafiabanner.webp",
  },
];

export function DashboardHome() {
  const [joinOpen, setJoinOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);

  useEffect(() => {
    const cached = getAuthUser();
    setUser(cached);
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

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pt-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-3 lg:py-5">
          <div className="flex items-center gap-2">
            <BrandMark size={40} className="lg:h-10 lg:w-10" />
            <div className="leading-tight">
              <p className="text-base font-semibold lg:text-lg">
                Jamoaviy.uz
              </p>
              <p className="text-xs text-ink-muted">Jamoaviy o'yinlar</p>
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
            Bugun qaysi o'yinni o'ynaymiz?
          </h1>

          <div className="mt-5 grid gap-5 lg:mt-8">
            {!usage ? (
              <div className="animate-pulse rounded-2xl border border-line-subtle bg-bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-bg-elevated" />
                  <div className="h-4 w-12 rounded bg-bg-elevated" />
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-bg-elevated" />
                <div className="mt-2 h-3 w-3/5 rounded bg-bg-elevated" />
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
                            100,
                        ),
                      )}%`,
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

            <ActiveGames />

            <div className="grid gap-3">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                O'yinlar
              </p>
              <div className="grid gap-4">
                {games.map((game) => (
                  <GameCardItem key={game.title} game={game} />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="flex h-12 items-center justify-center rounded-xl border border-line-strong bg-bg-surface text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
            >
              Kod orqali qo'shilish
            </button>
          </div>
        </section>
      </div>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </main>
  );
}

function GameCardItem({ game }: { game: GameCard }) {
  return (
    <Link
      href={game.href}
      className="group block overflow-hidden rounded-2xl border border-line-subtle bg-bg-surface transition active:scale-[0.99]"
    >
      {/* Landscape banner. The gradient sits underneath as a fallback
          while the image hydrates and as a backdrop if the file is
          ever missing. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${game.gradient}`}
        />
        <Image
          src={game.image}
          alt={game.title}
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover"
          priority={game.available}
        />
        {/* Slight dark scrim along the bottom so the rounded corner of
            the card meets the title block cleanly. */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
        {!game.available && (
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            Tez orada
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-lg font-semibold text-ink-primary">{game.title}</p>
        <p className="mt-1 text-sm text-ink-secondary">{game.subtitle}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
          <span>{game.players}</span>
          <span className="flex items-center gap-1 text-brand">
            Kirish
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
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
