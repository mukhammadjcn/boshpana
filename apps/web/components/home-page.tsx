"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { JoinRoomModal } from "@/components/join-room-modal";
import { getAuthToken } from "@/lib/auth";

export function HomePage() {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

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
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 pt-safe pb-safe">
        <header className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-base font-bold text-bg-base">
              B
            </span>
            <div className="leading-tight">
              <p className="text-base font-semibold">Boshpana</p>
              <p className="text-xs text-ink-muted">Bunker Online</p>
            </div>
          </div>
        </header>

        <section className="mt-6 flex-1">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            Halokat ortidan bunkerda{" "}
            <span className="text-brand">kim qoladi?</span>
          </h1>
          <p className="mt-4 text-base leading-7 text-ink-secondary">
            6 ta yashirin atribut, ovoz berish va eliminatsiya.
            Telefoningizdan do'stlaringiz bilan birga o'ynang.
          </p>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              Roomga qo'shilish
            </button>
            <p className="text-center text-xs text-ink-muted">
              Yangi o'yin yaratish uchun Telegram orqali tizimga kiring.
            </p>
          </div>

          <ol className="mt-8 grid gap-3">
            <Step
              n={1}
              title="Yaratasiz yoki qo'shilasiz"
              text="Host yaratadi, qolganlar kod yoki link orqali kiradi."
            />
            <Step
              n={2}
              title="Karta ochib, gaplashasiz"
              text="Har round bitta karta ochiladi va 2 daqiqada o'zingizni himoya qilasiz."
            />
            <Step
              n={3}
              title="Ovoz va eliminatsiya"
              text="Ovozlar tugagach kim ortiqcha ekanligi aniqlanadi."
            />
          </ol>
        </section>

        <footer className="mt-8 pb-2 text-center text-xs text-ink-dim">
          3–10 o'yinchi · Mobile-first · Telegram orqali kirish
        </footer>
      </div>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </main>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-sm font-semibold text-brand">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink-primary">{title}</p>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">{text}</p>
      </div>
    </li>
  );
}
