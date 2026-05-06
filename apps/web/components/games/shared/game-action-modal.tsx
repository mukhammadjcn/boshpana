"use client";

import type { ReactNode } from "react";

import { Timer } from "@/components/timer";

type AccentTone = "brand" | "warn" | "bad" | "muted";

const accentClass: Record<AccentTone, string> = {
  brand: "text-brand",
  warn: "text-warn",
  bad: "text-bad",
  muted: "text-ink-muted"
};

type GameActionModalProps = {
  sectionLabel: string;
  helper: ReactNode;
  accentTone?: AccentTone;
  secondsLeft?: number | null;
  timerVariant?: "default" | "danger" | "muted";
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export function GameActionModal({
  sectionLabel,
  helper,
  accentTone = "brand",
  secondsLeft,
  timerVariant = "default",
  badge,
  children,
  footer
}: GameActionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-base text-ink-primary">
      <header className="sticky top-0 z-10 border-b border-line-subtle bg-bg-base/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-5 pt-safe">
          <p
            className={`flex-1 text-sm font-semibold uppercase tracking-[0.2em] ${accentClass[accentTone]}`}
          >
            {sectionLabel}
          </p>
          {typeof secondsLeft === "number" ? (
            <Timer seconds={secondsLeft} variant={timerVariant} />
          ) : null}
          {badge ? badge : null}
        </div>
        <div className="px-5 pb-3 pt-2 text-base font-semibold leading-snug text-ink-primary">
          {helper}
        </div>
      </header>

      <div
        className="flex-1 overflow-y-auto px-5 py-4"
        style={{
          paddingBottom: footer
            ? "calc(env(safe-area-inset-bottom) + 8.5rem)"
            : "calc(env(safe-area-inset-bottom) + 1.25rem)"
        }}
      >
        {children}
      </div>

      {footer ? (
        <div className="sticky bottom-0 border-t border-line-subtle bg-bg-base/95 px-5 pb-safe pt-3 backdrop-blur">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
