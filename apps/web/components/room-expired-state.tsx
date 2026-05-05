"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { JoinRoomModal } from "@/components/join-room-modal";
import { TelegramChrome } from "@/components/telegram-chrome";
import { useI18n } from "@/lib/i18n";

type RoomExpiredStateProps = {
  roomCode: string;
  detail?: string | null;
  homeHref?: string;
};

const GENERIC_DETAILS = new Set(["Xona topilmadi.", "Room topilmadi."]);

export function RoomExpiredState({
  roomCode,
  detail,
  homeHref = "/dashboard"
}: RoomExpiredStateProps) {
  const { t } = useI18n();
  const [joinOpen, setJoinOpen] = useState(false);
  const normalizedDetail = detail?.trim() ?? "";
  const showDetail =
    normalizedDetail.length > 0 && !GENERIC_DETAILS.has(normalizedDetail);

  return (
    <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
      <TelegramChrome backHref={homeHref} />

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <section className="w-full rounded-[28px] border border-line-subtle bg-bg-surface p-5 shadow-card">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-bad">
            {t("Xona yopilgan")}
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight">
            {t("Bu xonada o'yin tugagan")}
          </h1>
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {t(
              "Xona allaqachon yakunlangan yoki tizimdan o'chirilgan. Bosh sahifaga qaytishingiz yoki yangi xona kodini kiritib boshqa o'yinga qo'shilishingiz mumkin."
            )}
          </p>

          <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-base p-4">
            <p className="text-xs text-ink-muted">{t("Eski xona kodi")}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em] text-ink-primary">
              {roomCode}
            </p>
          </div>

          {showDetail ? (
            <p className="mt-4 rounded-2xl border border-line-subtle bg-bg-base px-4 py-3 text-sm text-ink-secondary">
              {normalizedDetail}
            </p>
          ) : null}

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("Yangi xonaga qo'shilish")}
            </button>
            <Link
              href={homeHref as Route}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-base text-base font-semibold text-ink-primary transition active:scale-[0.98]"
            >
              {t("Bosh sahifaga qaytish")}
            </Link>
          </div>
        </section>
      </div>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </main>
  );
}
