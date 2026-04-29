"use client";

import { useState } from "react";
import Link from "next/link";

import { CreateRoomForm } from "@/components/create-room-form";
import { JoinRoomModal } from "@/components/join-room-modal";

export function CreateRoomPage() {
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 pt-safe pb-safe">
        <header className="flex items-center justify-between py-3">
          <Link
            href="/"
            className="-ml-2 flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-ink-secondary"
            aria-label="Bosh sahifa"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Orqaga
          </Link>
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="h-10 rounded-xl border border-line-strong bg-bg-surface px-4 text-sm font-semibold text-ink-primary"
          >
            Qo‘shilish
          </button>
        </header>

        <section className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-brand">
            Host setup
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            Yangi o‘yin yaratish
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            Nickname kiriting va o‘yin qaysi shartda yakunlanishini tanlang.
            Yaratilgach link va kod paydo bo‘ladi.
          </p>
        </section>

        <div className="mt-6 flex-1">
          <CreateRoomForm onOpenJoin={() => setJoinOpen(true)} />
        </div>
      </div>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </main>
  );
}
