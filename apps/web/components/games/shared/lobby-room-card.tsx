"use client";

import type { ReactNode } from "react";

type LobbyBadge = {
  label: string;
  tone?: "brand" | "neutral";
};

type LobbyRoomCardProps = {
  roomCodeLabel: string;
  roomCode: string;
  summary: string;
  gameLabel: string;
  badges?: LobbyBadge[];
  actions?: ReactNode;
};

function Badge({ label, tone = "neutral" }: LobbyBadge) {
  const className =
    tone === "brand"
      ? "border border-brand/30 bg-brand-soft text-brand"
      : "border border-line-strong bg-bg-base text-ink-secondary";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export function LobbyRoomCard({
  roomCodeLabel,
  roomCode,
  summary,
  gameLabel,
  badges = [],
  actions,
}: LobbyRoomCardProps) {
  return (
    <section className="mt-2 rounded-3xl border border-line-subtle bg-bg-surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-brand">
            {roomCodeLabel}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em]">
            {roomCode}
          </p>
          <p className="mt-2 text-sm text-ink-secondary">{summary}</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:max-w-[48%] sm:justify-end">
          <Badge label={gameLabel} tone="brand" />
          {badges.map((badge) => (
            <Badge key={`${badge.tone ?? "neutral"}-${badge.label}`} {...badge} />
          ))}
        </div>
      </div>

      {actions ? <div className="mt-5">{actions}</div> : null}
    </section>
  );
}
