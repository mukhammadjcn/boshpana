"use client";

import { useI18n } from "@/lib/i18n";

type LobbyPlayerCardProps = {
  name: string;
  isHost: boolean;
  isMe?: boolean;
  online?: boolean;
  isReady?: boolean;
  onReport?: () => void;
  onKick?: () => void;
};

export function LobbyPlayerCard({
  name,
  isHost,
  isMe = false,
  online,
  isReady = false,
  onReport,
  onKick,
}: LobbyPlayerCardProps) {
  const { t } = useI18n();
  const initials = getInitials(name);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl relative border border-line-subtle bg-bg-surface p-4 transition ${online === false ? "opacity-70" : ""}`}
    >
      <span
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-lg font-semibold uppercase ${
          isHost ? "bg-brand text-bg-base" : "bg-bg-elevated text-ink-primary"
        }`}
      >
        {initials}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink-primary">
          {name}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted">
          {online === false
            ? t("tarmoqda_emas")
            : isMe
              ? t("siz_2")
              : isHost
                ? t("host")
                : t("oyinchi_2")}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <PresenceBadge online={!!online} />
        {isReady ? <ReadyBadge /> : null}
      </div>

      {onReport ? (
        <button
          type="button"
          onClick={onReport}
          aria-label={t("kick_uchun_ovoz_boshlash")}
          className="grid h-[18px] w-[18px] absolute -top-1 -right-1 rounded-lg shrink-0 place-items-center border border-warn/35 bg-[#272727] text-warn transition active:scale-95"
        >
          <span className="text-xs font-semibold leading-none">!</span>
        </button>
      ) : null}

      {onKick ? (
        <button
          type="button"
          onClick={onKick}
          aria-label={t("name_ni_chiqarish", { name })}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bad/40 bg-bad/10 text-bad transition active:scale-95"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function PresenceBadge({ online }: { online: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase ${
        online ? "bg-ok/15 text-ok" : "bg-bg-elevated text-ink-muted"
      }`}
    >
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${online ? "bg-ok" : "bg-ink-muted"}`}
      />
      {online ? t("onlayn") : t("offlayn")}
    </span>
  );
}

function ReadyBadge() {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-[10px] font-semibold uppercase text-brand">
      <span aria-hidden className="h-2 w-2 rounded-full bg-brand" />
      {t("tayyor")}
    </span>
  );
}

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
