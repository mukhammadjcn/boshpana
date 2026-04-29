"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";

import { JoinRoomModal } from "@/components/join-room-modal";

export function HomePage() {
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_28%),linear-gradient(180deg,#07101c_0%,#020617_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(251,146,60,0.08),transparent)]" />
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-orange-300/20 bg-orange-400/10 px-4 py-2 text-[11px] uppercase tracking-[0.45em] text-orange-100/80">
              Bunker Online
            </span>
            <span className="rounded-full border border-sky-300/15 bg-sky-400/10 px-4 py-2 text-xs text-sky-100/80">
              Real-time party game
            </span>
          </div>
          {/* <Link
            href="/admin/login"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
          >
            Admin panel
          </Link> */}
        </header>

        <section className="mt-8 rounded-[2.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.96))] p-7 shadow-2xl shadow-orange-950/10 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.38em] text-orange-200/70">
                Psixologik strategiya o‘yini
              </p>
              <h1 className="mt-5 max-w-4xl text-5xl font-bold leading-[0.96] tracking-tight text-white sm:text-6xl">
                Halokatdan keyin bunkerda kim qolishi kerakligini birga hal
                qilasiz.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Har bir o‘yinchi yashirin atributlarga ega bo‘ladi: kasb,
                sog‘liq, xarakter, skill, bagaj va fakt. Har roundda kimdir o‘z
                kartasini ochadi, jamoa bahslashadi, keyin esa kim qolishi
                kerakligi bo‘yicha qaror yaqinlashadi.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={"/create" as Route}
                  className="rounded-full bg-orange-500 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-orange-400"
                >
                  O‘yinni boshlash
                </Link>
                <button
                  type="button"
                  onClick={() => setJoinOpen(true)}
                  className="rounded-full border border-white/15 bg-white/8 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/12"
                >
                  O‘yinga qo‘shilish
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              <HighlightCard
                eyebrow="Qanday ishlaydi"
                title="Host yaratadi, link ulashadi, keyin o‘yinni boshqaradi."
              />
              <HighlightCard
                eyebrow="Nima uchun qiziq"
                title="Har ochilgan karta qarorni o‘zgartiradi va hech kim boshidan kuchli emas."
              />
              <HighlightCard
                eyebrow="MVP imkoniyatlari"
                title="Admin paneldan kartalar, falokatlar va situation’larni to‘ldirish mumkin."
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <FeatureCard
            step="01"
            title="Falokat va rol"
            description="O‘yin boshida umumiy falokat ko‘rsatiladi. Har bir o‘yinchi esa o‘ziga tushgan 6 ta atributni ko‘radi."
          />
          <FeatureCard
            step="02"
            title="Navbat bilan reveal"
            description="Kasb avtomatik ochiladi, qolgan kartalar esa round davomida navbat bilan tanlab ochiladi."
          />
          <FeatureCard
            step="03"
            title="Ovoz va eliminatsiya"
            description="Har round oxirida host voting ochishi mumkin. Ovozlar tugagach bitta odam o‘yindan chiqadi, lekin kuzatib turadi."
          />
        </section>
      </div>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </main>
  );
}

function HighlightCard({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
        {eyebrow}
      </p>
      <p className="mt-3 text-lg font-semibold leading-7 text-slate-100">
        {title}
      </p>
    </div>
  );
}

function FeatureCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
      <p className="text-xs uppercase tracking-[0.32em] text-orange-200/70">
        {step}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}
