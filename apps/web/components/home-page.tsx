"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getAuthToken } from "@/lib/auth";

const FEATURES = [
  {
    title: "6 yashirin atribut",
    body: "Har bir o'yinchiga kasb, sog'liq, xarakter, skill, bagaj va fakt tushadi. Ularni qachon ochishni o'zingiz hal qilasiz.",
    icon: "🃏",
  },
  {
    title: "Real-time o'yin",
    body: "Hammasi telefoningizda — round, taymerli pitch, ovoz berish va eliminatsiya jonli ravishda yuradi.",
    icon: "⚡",
  },
  {
    title: "3-10 o'yinchi",
    body: "Kichkina davradan to'liq mehmonxonagacha. Limitga qarab finish — 1, 2 yoki 3 kishi qolganda tugaydi.",
    icon: "👥",
  },
  {
    title: "Aniq tiebreak",
    body: "Ovozlar teng kelsa tizim random tanlamaydi — qayta ovoz bosqichi ochiladi va hayotingizni himoya qilasiz.",
    icon: "⚖️",
  },
  {
    title: "Telegram-first",
    body: "Hisob — Telegram orqali. Lobbyni do'stlarga forward qilasiz, kod kiritish shart emas.",
    icon: "📨",
  },
  {
    title: "O'yinlar tarixi",
    body: "Tugagan o'yinlaringiz tarixda saqlanadi — qaysi falokat, kim g'olib bo'lgan, qancha vaqt bo'lgan.",
    icon: "🗂️",
  },
];

const STEPS = [
  {
    n: 1,
    title: "Telegramda kirasiz",
    body: "Bot orqali bir martalik avtorizatsiya. Telefon raqamingiz so'raladi, keyingi kirishlarda avtomatik kirib turasiz.",
  },
  {
    n: 2,
    title: "Room yaratasiz yoki qo'shilasiz",
    body: "Host yaratadi va lobbyni Telegramda forward qiladi. Qolganlar bir bosishda ichkariga tushadi.",
  },
  {
    n: 3,
    title: "Karta ochib, gaplashasiz",
    body: "Har round bitta atribut ochiladi va 2 daqiqada o'zingizni himoya qilasiz.",
  },
  {
    n: 4,
    title: "Ovoz va eliminatsiya",
    body: "Round oxirida kim ortiqcha ekanligi aniqlanadi. Tirik qolganlar finish‑ga yetib boradi.",
  },
];

const ATTRIBUTES = [
  { label: "Kasb", hint: "Bunkerga foyda?" },
  { label: "Sog'liq", hint: "Halokatga chidaysiz?" },
  { label: "Xarakter", hint: "Jamoa bilan til topasiz?" },
  { label: "Skill", hint: "Qaysi yo'nalishda yordam berasiz?" },
  { label: "Bagaj", hint: "Yoningizda nima bor?" },
  { label: "Fakt", hint: "Sir yoki ustunlik" },
];

export function HomePage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const loginHref = "/login" as Route;

  useEffect(() => {
    if (getAuthToken()) {
      setRedirecting(true);
      router.replace("/dashboard" as Route);
    }
  }, [router]);

  if (redirecting) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg-base text-ink-secondary">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          Yuklanmoqda...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line-subtle bg-bg-base/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-base font-bold text-bg-base">
              B
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold sm:text-base">Boshpana</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-muted sm:text-xs">
                Bunker Online
              </p>
            </div>
          </div>
          <BotCta
            href={loginHref}
            label="Telegramda ochish"
            variant="primary"
            size="sm"
          />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line-subtle">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,107,46,0.18),transparent)]" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand">
              Telegram party game · Real-time
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Halokat ortidan bunkerda{" "}
              <span className="text-brand">kim qoladi?</span>
            </h1>
            <p className="mt-4 text-base leading-7 text-ink-secondary sm:text-lg sm:leading-8">
              6 ta yashirin atribut, jonli pitch va ovoz berish. Telegramda
              do'stlaringiz bilan 10 daqiqada bunkerga kim loyiqligini hal
              qilasiz — barchasi telefondan, hech qanday o'rnatuvchi ilovasiz.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="sm:hidden">
                <BotCta
                  href={loginHref}
                  label="Telegramda boshlash"
                  variant="primary"
                  size="lg"
                />
              </div>
              <p className="text-xs text-ink-muted sm:text-sm">
                O'yin yaratish va qo'shilish uchun Telegram orqali kiring
              </p>
            </div>

            <ul className="mt-8 grid grid-cols-3 gap-3 text-center text-xs sm:text-sm">
              <Stat value="3–10" label="o'yinchi" />
              <Stat value="~10 daq" label="o'rtacha" />
              <Stat value="Mobile" label="first" />
            </ul>
          </div>

          {/* Hero card */}
          <div className="relative">
            <div className="rounded-3xl border border-line-subtle bg-bg-surface p-5 shadow-pop sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
                  Round 3 · 6 tirik
                </p>
                <span className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">
                  Pitch
                </span>
              </div>
              <p className="mt-3 text-lg font-semibold leading-snug">
                Falokat: Quyosh portlashi
              </p>
              <p className="mt-1 text-sm text-ink-secondary">
                Bunkerda 4 kishilik joy bor. Atributlaringizni asosli tarzda
                himoya qilishingiz kerak.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {ATTRIBUTES.slice(0, 4).map((a) => (
                  <div
                    key={a.label}
                    className="rounded-xl border border-line-subtle bg-bg-base/60 p-3"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                      {a.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{a.hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-line-subtle bg-bg-base/60 px-3 py-2.5">
                <p className="text-xs text-ink-secondary">Pitch qoldi</p>
                <p className="font-mono text-sm font-semibold text-brand">
                  01:42
                </p>
              </div>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -right-6 -z-10 h-32 w-32 rounded-full bg-brand/30 blur-3xl"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              Qanday o'ynaladi
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              4 qadamda do'stlar bilan jonli o'yin
            </h2>
            <p className="mt-3 text-sm text-ink-secondary sm:text-base">
              Faqat Telegram kerak. Hech qanday qo'shimcha ilova yoki hisob
              yaratish shart emas.
            </p>
          </div>

          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="rounded-2xl border border-line-subtle bg-bg-surface p-5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-mono text-sm font-semibold text-brand">
                  {s.n}
                </span>
                <p className="mt-3 text-sm font-semibold sm:text-base">
                  {s.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              Nimasi bor
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Hammasi o'yin uchun moslangan
            </h2>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="rounded-2xl border border-line-subtle bg-bg-surface p-5"
              >
                <span className="text-2xl" aria-hidden>
                  {f.icon}
                </span>
                <p className="mt-3 text-base font-semibold">{f.title}</p>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Attributes preview */}
      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              Sizning kartalaringiz
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              6 ta yashirin atribut — har biri bahsli
            </h2>
            <p className="mt-3 text-sm text-ink-secondary sm:text-base">
              Hammasi o'yin boshida tushadi. Qaysi birini ochish — strategiya.
            </p>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ATTRIBUTES.map((a) => (
              <li
                key={a.label}
                className="flex items-start gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-4"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft font-mono text-xs font-semibold text-brand">
                  {a.label.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{a.label}</p>
                  <p className="mt-1 text-xs text-ink-secondary sm:text-sm">
                    {a.hint}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="rounded-3xl border border-line-subtle bg-gradient-to-br from-brand/15 via-bg-surface to-bg-surface p-6 sm:p-10 lg:p-14">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div>
                <h2 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                  Bugun do'stlar bilan birga{" "}
                  <span className="text-brand">o'ynashga tayyormisiz?</span>
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink-secondary sm:text-base">
                  Bir bosishda Telegramga o'tasiz, bir martalik avtorizatsiya —
                  keyin har safar avtomatik kirib turasiz.
                </p>
              </div>
              <div className="grid gap-3">
                <BotCta
                  href={loginHref}
                  label="Telegramda boshlash"
                  variant="primary"
                  size="lg"
                />
                <p className="text-center text-xs text-ink-muted">
                  Hisob — Telegram orqali. Boshqa narsa kerak emas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line-subtle">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Boshpana — Bunker Online</p>
          <p>3–10 o'yinchi · Mobile-first · Telegram orqali</p>
        </div>
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <li className="rounded-xl border border-line-subtle bg-bg-surface px-3 py-2.5">
      <p className="text-base font-bold sm:text-lg">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-ink-muted sm:text-xs">
        {label}
      </p>
    </li>
  );
}

function BotCta({
  href,
  label,
  variant,
  size,
}: {
  href: Route;
  label: string;
  variant: "primary" | "secondary";
  size: "sm" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-14 px-6 text-base sm:h-14"
      : "h-10 px-4 text-xs sm:text-sm";
  const variantClass =
    variant === "primary"
      ? "bg-brand text-bg-base"
      : "border border-line-strong bg-bg-surface text-ink-primary";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] ${sizeClass} ${variantClass}`}
    >
      <span aria-hidden>✈</span>
      {label}
    </Link>
  );
}
