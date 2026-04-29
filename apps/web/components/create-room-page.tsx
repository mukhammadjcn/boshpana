"use client";

import { useState } from "react";
import Link from "next/link";

import { CreateRoomForm } from "@/components/create-room-form";
import { JoinRoomModal } from "@/components/join-room-modal";

export function CreateRoomPage() {
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.14),transparent_20%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_24%),linear-gradient(180deg,#07101c_0%,#020617_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
          >
            Bosh sahifaga qaytish
          </Link>
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Roomga qo‘shilish
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.96))] p-7">
            <p className="text-xs uppercase tracking-[0.35em] text-orange-200/70">
              Host setup
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl">
              O‘yin yaratishdan oldin faqat kerakli narsalarni belgilang.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Host nickname va finish shartini tanlaysiz. Room yaratilgach sizga
              maxsus link beriladi. Shu linkni ulashasiz, playerlar esa login
              qilmasdan to‘g‘ridan-to‘g‘ri roomga kiradi.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <InfoTile
                title="1"
                text="Host room yaratadi va invite link oladi."
              />
              <InfoTile
                title="2"
                text="Playerlar link yoki code bilan join qiladi."
              />
              <InfoTile
                title="3"
                text="O‘yin boshlangach yangi odam qo‘shila olmaydi."
              />
            </div>
          </section>

          <div className="space-y-5">
            <CreateRoomForm onOpenJoin={() => setJoinOpen(true)} />
            {/* <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">
                Eslatma
              </p>
              <div className="mt-4 grid gap-3 text-sm leading-7 text-slate-300">
                <p>Host room ichida playerlar ro‘yxatini ko‘radi va o‘yinni start qiladi.</p>
                <p>O‘yin boshlangach share bo‘limi yopiladi va room lock holatga o‘tadi.</p>
                <p>Admin panel orqali kartalar, falokatlar va situation’larni keyin to‘ldirasiz.</p>
              </div>
            </div> */}
          </div>
        </div>
      </div>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </main>
  );
}

function InfoTile({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-lg font-semibold text-orange-200">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}
