"use client";

import { useI18n } from "@/lib/i18n";

const cardLabels: Record<string, string> = {
  PROFESSION: "Kasb",
  HEALTH: "Sog‘liq",
  CHARACTER: "Xarakter",
  SKILL: "Ko‘nikma",
  BAGGAGE: "Bagaj",
  FACT: "Fakt"
};

type PlayerCardProps = {
  name: string;
  isHost: boolean;
  isAlive: boolean;
  revealedCards: Partial<Record<string, string>>;
  isMe?: boolean;
  isCurrentTurn?: boolean;
  variant?: "row" | "tile";
  gameOver?: boolean;
  // Whether this player currently has a live socket attached. Only renders
  // a green/gray dot when `showPresence` is true — we deliberately hide
  // presence in the in-game view (alive/dead and current-turn already
  // dominate the row) and surface it only in the lobby tile layout.
  online?: boolean;
  showPresence?: boolean;
  isReady?: boolean;
  // Server-computed hint based on this round's situation tags vs the
  // player's revealed-card tags. Pure discussion hint — voting stays free.
  situationBadge?: "green" | "red" | "neutral";
  onKick?: () => void;
  onReport?: () => void;
};

export function PlayerCard({
  name,
  isHost,
  isAlive,
  revealedCards,
  isMe,
  isCurrentTurn,
  variant = "row",
  gameOver = false,
  online,
  showPresence = false,
  isReady = false,
  situationBadge = "neutral",
  onKick,
  onReport
}: PlayerCardProps) {
  const { t } = useI18n();
  const entries = Object.entries(revealedCards).filter(([, value]) => value);
  const initials = getInitials(name);
  const canKick = !!onKick && isAlive && !isHost;
  const canReport = !!onReport && isAlive;

  // After the game ends, recolor cards: winners (alive) green, losers
  // (eliminated) red. Mid-game uses neutral / red-on-eliminated styling.
  const containerTone = isCurrentTurn
    ? "border-brand bg-brand-soft"
    : gameOver
      ? isAlive
        ? "border-ok/40 bg-ok/10"
        : "border-bad/40 bg-bad/10 opacity-90"
      : isAlive
        ? "border-line-subtle bg-bg-surface"
        : "border-bad/30 bg-bad/5 opacity-80";

  if (variant === "tile") {
    const showOffline = showPresence && online === false;
    return (
      <div
        className={`flex flex-col gap-2 rounded-2xl border p-3 transition ${containerTone} ${
          showOffline ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <Avatar
            initials={initials}
            isHost={isHost}
            isAlive={isAlive}
            gameOver={gameOver}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-[11px] text-ink-muted">
              {showPresence && online === false
                ? t("tarmoqda_emas")
                : isMe
                  ? t("siz_2")
                  : isHost
                    ? t("host")
                    : t("oyinchi_2")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {showPresence ? (
              <>
                <PresenceDot online={!!online} />
                {isReady ? <ReadyDot /> : null}
              </>
            ) : (
              <StatusDot
                isAlive={isAlive}
                isCurrentTurn={isCurrentTurn}
                gameOver={gameOver}
              />
            )}
            {canReport ? (
              <button
                type="button"
                onClick={onReport}
                aria-label={t("kick_uchun_ovoz_boshlash")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-warn/30 bg-warn/10 text-warn transition active:scale-95"
              >
                !
              </button>
            ) : null}
            {canKick ? (
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
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border transition ${containerTone}`}>
      <div className="flex items-center gap-3 p-3">
        <div className="shrink-0">
          <Avatar
            initials={initials}
            isHost={isHost}
            isAlive={isAlive}
            gameOver={gameOver}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-ink-primary">
              {name}
            </p>
            {isMe ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-brand">
                {t("siz_2")}
              </span>
            ) : null}
            {isHost ? (
              <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-secondary">
                {t("host")}
              </span>
            ) : null}
            {situationBadge === "green" ? (
              <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-ok">
                ✓
              </span>
            ) : null}
            {situationBadge === "red" ? (
              <span className="rounded-full bg-bad/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-bad">
                !
              </span>
            ) : null}
          </div>
          <p
            className={`mt-0.5 text-xs ${
              gameOver
                ? isAlive
                  ? "font-semibold text-ok"
                  : "font-semibold text-bad"
                : "text-ink-muted"
            }`}
          >
            {isCurrentTurn
              ? t("hozir_navbat")
              : gameOver
                ? isAlive
                  ? t("yutgan")
                  : t("yutqazgan")
                : isAlive
                  ? t("count_6_ochiq", { count: entries.length })
                  : t("oyindan_chiqqan")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canReport ? (
            <button
              type="button"
              onClick={onReport}
              aria-label={t("kick_uchun_ovoz_boshlash")}
              className="grid h-8 w-8 place-items-center rounded-full border border-warn/40 bg-warn/12 text-sm font-semibold text-warn transition active:scale-95"
            >
              !
            </button>
          ) : null}
          {canKick ? (
            <button
              type="button"
              onClick={onKick}
              aria-label={t("name_ni_chiqarish", { name })}
              className="grid h-9 w-9 place-items-center rounded-full border border-bad/40 bg-bad/10 text-bad transition active:scale-95"
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
          <StatusDot isAlive={isAlive} isCurrentTurn={isCurrentTurn} />
        </div>
      </div>

      {entries.length ? (
        <div className="grid gap-1.5 border-t border-line-subtle p-3 pt-2.5">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-2 text-sm">
              <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                {cardLabels[key] ? t(cardLabels[key]) : key}
              </span>
              <span className="flex-1 text-ink-primary">{value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Avatar({
  initials,
  isHost,
  isAlive,
  gameOver
}: {
  initials: string;
  isHost: boolean;
  isAlive: boolean;
  gameOver: boolean;
}) {
  const tone = gameOver
    ? isAlive
      ? "bg-ok/20 text-ok"
      : "bg-bad/15 text-bad"
    : isHost
      ? "bg-brand text-bg-base"
      : isAlive
        ? "bg-bg-elevated text-ink-primary"
        : "bg-bad/15 text-bad";
  return (
    <div
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold ${tone}`}
    >
      {initials}
    </div>
  );
}

function StatusDot({
  isAlive,
  isCurrentTurn,
  gameOver
}: {
  isAlive: boolean;
  isCurrentTurn?: boolean;
  gameOver?: boolean;
}) {
  const { t } = useI18n();
  if (isCurrentTurn) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-semibold uppercase text-bg-base">
        {t("navbat")}
      </span>
    );
  }
  if (gameOver) {
    return (
      <span
        className={`flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
          isAlive ? "bg-ok/20 text-ok" : "bg-bad/15 text-bad"
        }`}
      >
        {isAlive ? t("yutgan") : t("chiqqan")}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
        isAlive ? "bg-ok" : "bg-bad"
      }`}
    />
  );
}

function PresenceDot({ online }: { online: boolean }) {
  const { t } = useI18n();
  return (
    <span
      aria-label={online ? t("tarmoqda") : t("tarmoqdan_tushgan")}
      title={online ? t("tarmoqda") : t("tarmoqdan_tushgan")}
      className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
        online
          ? "bg-ok/15 text-ok"
          : "bg-bg-elevated text-ink-muted"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          online ? "bg-ok" : "bg-ink-muted"
        }`}
      />
      {online ? t("onlayn") : t("offlayn")}
    </span>
  );
}

function ReadyDot() {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-1 rounded-full bg-brand-soft px-2 py-1 text-[10px] font-semibold uppercase text-brand">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
      {t("tayyor")}
    </span>
  );
}

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
