"use client";

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
};

export function PlayerCard({
  name,
  isHost,
  isAlive,
  revealedCards,
  isMe,
  isCurrentTurn,
  variant = "row"
}: PlayerCardProps) {
  const entries = Object.entries(revealedCards).filter(([, value]) => value);
  const initials = getInitials(name);

  if (variant === "tile") {
    return (
      <div
        className={`flex flex-col gap-2 rounded-2xl border p-3 transition ${
          isCurrentTurn
            ? "border-brand bg-brand-soft"
            : isAlive
              ? "border-line-subtle bg-bg-surface"
              : "border-bad/30 bg-bad/5 opacity-70"
        }`}
      >
        <div className="flex items-center gap-2">
          <Avatar initials={initials} isHost={isHost} isAlive={isAlive} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-[11px] text-ink-muted">
              {isMe ? "Siz" : isHost ? "Host" : "O‘yinchi"}
            </p>
          </div>
          <StatusDot isAlive={isAlive} isCurrentTurn={isCurrentTurn} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border transition ${
        isCurrentTurn
          ? "border-brand bg-brand-soft"
          : isAlive
            ? "border-line-subtle bg-bg-surface"
            : "border-bad/30 bg-bad/5 opacity-80"
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <Avatar initials={initials} isHost={isHost} isAlive={isAlive} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-ink-primary">
              {name}
            </p>
            {isMe ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-brand">
                Siz
              </span>
            ) : null}
            {isHost ? (
              <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-secondary">
                Host
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            {isCurrentTurn
              ? "Hozir navbat"
              : isAlive
                ? `${entries.length}/6 ochiq`
                : "O‘yindan chiqqan"}
          </p>
        </div>
        <StatusDot isAlive={isAlive} isCurrentTurn={isCurrentTurn} />
      </div>

      {entries.length ? (
        <div className="grid gap-1.5 border-t border-line-subtle p-3 pt-2.5">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-2 text-sm">
              <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                {cardLabels[key] ?? key}
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
  isAlive
}: {
  initials: string;
  isHost: boolean;
  isAlive: boolean;
}) {
  return (
    <div
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold ${
        isHost
          ? "bg-brand text-bg-base"
          : isAlive
            ? "bg-bg-elevated text-ink-primary"
            : "bg-bad/15 text-bad"
      }`}
    >
      {initials}
    </div>
  );
}

function StatusDot({
  isAlive,
  isCurrentTurn
}: {
  isAlive: boolean;
  isCurrentTurn?: boolean;
}) {
  if (isCurrentTurn) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-semibold uppercase text-bg-base">
        Navbat
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
