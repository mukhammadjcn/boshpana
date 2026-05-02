"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { JoinRoomModal } from "@/components/join-room-modal";

const rules = [
  "10 o'yinchi: 6 fuqaro, 1 sherif, 2 mafiya, 1 don.",
  "Tunda mafiya sokin nishonni tanlaydi, sherif esa kim mafiyaligini tekshiradi.",
  "Kunduzi hamma muhokama qiladi va shubhalini ovoz orqali chetlatadi.",
  "Mafiya barcha boshqalardan ko'p qolsa — ular g'olib. Aksincha — shahar.",
];

export function MafiaCreatePage() {
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
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
          <p className="text-sm font-semibold">Mafia</p>
          <span className="h-9 w-9" />
        </header>

        <section className="mt-2 flex-1 pb-10 lg:mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            Kun va tun mafiya
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            Mafia — kim xiyonatkor?
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            8-12 o'yinchi · 30-45 daqiqa
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

          <div className="mt-6 grid gap-3 rounded-2xl border border-dashed border-line-strong bg-bg-surface p-6 text-center">
            <p className="text-2xl">🚧</p>
            <p className="text-base font-semibold">Tez orada</p>
            <p className="text-sm text-ink-muted">
              Mafia o'yini ishlab chiqilmoqda. Bu yerda o'yin yaratish bo'limi
              paydo bo'ladi.
            </p>
          </div>

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
