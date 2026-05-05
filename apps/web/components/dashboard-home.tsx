"use client";

import type { Route } from "next";
import { BrandMark } from "@/components/brand-mark";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { JoinRoomModal } from "@/components/join-room-modal";
import { LanguageSwitcher } from "@/components/language-switcher";
import { apiRequest } from "@/lib/api";
import { type AuthUser, getAuthUser, setAuthUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
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
    subtitle: "bunker_subtitle",
    players: "bunker_metadata",
    gradient: "from-amber-700 via-orange-900 to-stone-950",
    available: true,
    image: "/bunkerbanner.webp",
  },
  {
    href: "/dashboard/create/mafia" as Route,
    title: "Mafia",
    subtitle: "mafia_subtitle",
    players: "mafia_metadata",
    gradient: "from-violet-800 via-slate-900 to-zinc-950",
    available: true,
    image: "/mafiabanner.webp",
  },
];

export function DashboardHome() {
  const { t } = useI18n();
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

  const greeting = user?.nickname ?? user?.firstName ?? t("dostim");
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
              <p className="text-xs text-ink-muted">{t("jamoaviy_oyinlar")}</p>
            </div>
          </div>
          <LanguageSwitcher variant="select" />
        </header>

        <section className="mt-2 flex-1 pb-10 lg:mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            {t("salom_name", { name: greeting })}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            {t("bugun_qaysi_oyinni_oynaymiz")}
          </h1>

          <div className="mt-5 grid gap-5 lg:mt-8">
            {usage && limitReached ? (
              <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-semibold text-ink-primary">{t("oylik_limit")}</p>
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
                  {t(
                    "30 kunda {limit} ta o'yin yarata olasiz. Limit tugagan — keyingi davrigacha kuting.",
                    { limit: usage.roomCreationLimit }
                  )}
                </p>
              </div>
            ) : null}

            <ActiveGames />

            <div className="grid gap-3">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                {t("oyinlar")}
              </p>
              {!usage ? (
                <div className="grid gap-4">
                  {games.map((game) => (
                    <GameCardSkeleton key={game.title} />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4">
                  {games.map((game) => (
                    <GameCardItem key={game.title} game={game} />
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="flex h-12 items-center justify-center rounded-xl border border-line-strong bg-bg-surface text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
            >
              {t("kod_orqali_qoshilish")}
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
            <Translated text="tez_orada" />
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-lg font-semibold text-ink-primary">{game.title}</p>
        <p className="mt-1 text-sm text-ink-secondary">
          <Translated text={game.subtitle} />
        </p>
        <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
          <span>
            <Translated text={game.players} />
          </span>
          <span className="flex items-center gap-1 text-brand">
            <Translated text="kirish_label" />
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

function Translated({ text }: { text: string }) {
  const { t } = useI18n();
  return <>{t(text)}</>;
}

function GameCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-subtle bg-bg-surface">
      <div className="aspect-[16/9] w-full animate-pulse bg-bg-elevated" />
      <div className="p-4">
        <div className="h-6 w-28 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-1 h-4 w-2/3 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-4 flex items-center justify-between">
          <div className="h-4 w-32 animate-pulse rounded bg-bg-elevated" />
          <div className="h-4 w-12 animate-pulse rounded bg-bg-elevated" />
        </div>
      </div>
    </div>
  );
}
