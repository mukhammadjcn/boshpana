"use client";

type TimerProps = {
  seconds: number;
  variant?: "default" | "warning" | "danger" | "muted";
};

export function Timer({ seconds, variant = "default" }: TimerProps) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const remainder = (safe % 60).toString().padStart(2, "0");

  const tone =
    variant === "danger" || (variant === "default" && safe <= 10 && safe > 0)
      ? "border-bad/50 bg-bad/10 text-bad"
      : variant === "warning"
        ? "border-warn/45 bg-warn/10 text-warn"
      : variant === "muted"
        ? "border-line-subtle bg-bg-elevated text-ink-secondary"
        : "border-brand-ring bg-brand-soft text-brand";

  return (
    <div
      className={`inline-flex h-9 min-w-[112px] items-center justify-center gap-1.5 rounded-full border px-4 font-mono text-sm font-semibold tabular-nums ${tone}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {minutes}:{remainder}
    </div>
  );
}
