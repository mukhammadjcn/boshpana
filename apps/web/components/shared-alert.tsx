"use client";

import type { ReactNode } from "react";

type SharedAlertProps = {
  children: ReactNode;
  title?: string;
  variant?: "info" | "success" | "warning" | "danger";
  className?: string;
};

const VARIANTS = {
  info: {
    shell: [
      "border-cyan-400/[0.28]",
      "bg-[linear-gradient(135deg,rgba(14,28,40,0.97)_0%,rgba(10,20,30,0.99)_100%)]",
      "shadow-[0_0_0_1px_rgba(34,211,238,0.06)_inset,0_20px_50px_rgba(0,0,0,0.4),0_0_30px_rgba(34,211,238,0.06)]",
    ],
    blob: "bg-cyan-400/[0.22]",
    iconWrap: "shadow-[0_0_16px_rgba(34,211,238,0.30)]",
    iconDot:
      "bg-[linear-gradient(160deg,#22d3ee,#0891b2)] text-cyan-950 shadow-[0_4px_14px_rgba(34,211,238,0.45)]",
    title: "text-cyan-400",
    symbol: "!",
  },
  success: {
    shell: [
      "border-emerald-400/[0.28]",
      "bg-[linear-gradient(135deg,rgba(12,28,22,0.97)_0%,rgba(10,20,18,0.99)_100%)]",
      "shadow-[0_0_0_1px_rgba(52,211,153,0.06)_inset,0_20px_50px_rgba(0,0,0,0.4),0_0_30px_rgba(52,211,153,0.06)]",
    ],
    blob: "bg-emerald-400/[0.22]",
    iconWrap: "shadow-[0_0_16px_rgba(52,211,153,0.30)]",
    iconDot:
      "bg-[linear-gradient(160deg,#34d399,#059669)] text-emerald-950 shadow-[0_4px_14px_rgba(52,211,153,0.45)]",
    title: "text-emerald-400",
    symbol: "✓",
  },
  warning: {
    shell: [
      "border-amber-400/[0.28]",
      "bg-[linear-gradient(135deg,rgba(30,22,10,0.97)_0%,rgba(24,18,8,0.99)_100%)]",
      "shadow-[0_0_0_1px_rgba(251,191,36,0.06)_inset,0_20px_50px_rgba(0,0,0,0.4),0_0_30px_rgba(251,191,36,0.08)]",
    ],
    blob: "bg-amber-400/[0.22]",
    iconWrap: "shadow-[0_0_16px_rgba(251,191,36,0.30)]",
    iconDot:
      "bg-[linear-gradient(160deg,#fbbf24,#d97706)] text-amber-950 shadow-[0_4px_14px_rgba(251,191,36,0.45)]",
    title: "text-amber-400",
    symbol: "!",
  },
  danger: {
    shell: [
      "border-rose-400/[0.28]",
      "bg-[linear-gradient(135deg,rgba(32,14,20,0.97)_0%,rgba(26,12,18,0.99)_100%)]",
      "shadow-[0_0_0_1px_rgba(251,113,133,0.06)_inset,0_20px_50px_rgba(0,0,0,0.4),0_0_30px_rgba(251,113,133,0.06)]",
    ],
    blob: "bg-rose-400/[0.22]",
    iconWrap: "shadow-[0_0_16px_rgba(251,113,133,0.30)]",
    iconDot:
      "bg-[linear-gradient(160deg,#fb7185,#e11d48)] text-rose-950 shadow-[0_4px_14px_rgba(251,113,133,0.45)]",
    title: "text-rose-400",
    symbol: "!",
  },
} as const;

export function SharedAlert({
  children,
  title,
  variant = "info",
  className = "",
}: SharedAlertProps) {
  const v = VARIANTS[variant];

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[20px] border",
        "flex items-center gap-4 px-4 py-4",
        // scan-line texture via bg-image
        "bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.015)_2px,rgba(255,255,255,0.015)_4px)]",
        ...v.shell,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* glow blob */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -left-5 -top-5 h-20 w-20 rounded-full blur-[28px] ${v.blob}`}
      />

      {/* icon */}
      <div
        className={`relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-white/[0.12] bg-white/[0.08] ${v.iconWrap}`}
      >
        <span
          aria-hidden
          className={`grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold ${v.iconDot}`}
        >
          {v.symbol}
        </span>
      </div>

      {/* text */}
      <div className="relative min-w-0 flex-1">
        {title && (
          <p
            className={`text-[13px] font-bold uppercase tracking-[0.08em] ${v.title} mb-1`}
          >
            {title}
          </p>
        )}
        <div className="text-sm leading-[1.55] text-white/65">{children}</div>
      </div>
    </div>
  );
}
