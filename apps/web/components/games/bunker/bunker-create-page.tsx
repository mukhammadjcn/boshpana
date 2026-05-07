"use client";

import type { Route } from "next";
import { TelegramChrome } from "@/components/telegram-chrome";
import Link from "next/link";

import { useI18n } from "@/lib/i18n";
import { CreatePageTabs } from "../shared/create-page-tabs";
import { useCreateTabMode } from "../shared/use-create-tab-mode";
import { BunkerFriendsCreate } from "./bunker-friends-create";
import { OnlineBunkerCreate } from "../online-bunker/online-bunker-create";

export function BunkerCreatePage() {
  const { t } = useI18n();
  const [mode, setMode] = useCreateTabMode();

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <TelegramChrome backHref="/dashboard" />
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pt-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-3 lg:py-5">
          <Link
            href={"/dashboard" as Route}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line-strong bg-bg-surface text-ink-secondary"
            aria-label={t("orqaga")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            {t("apokalipsis_stol_oyini")}
          </p>
          <span className="h-9 w-9" />
        </header>

        <CreatePageTabs value={mode} onChange={setMode} />

        {mode === "friends" ? <BunkerFriendsCreate /> : <OnlineBunkerCreate />}
      </div>
    </main>
  );
}
