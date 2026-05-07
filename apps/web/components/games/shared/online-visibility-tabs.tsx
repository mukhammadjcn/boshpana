"use client";

import { useI18n } from "@/lib/i18n";

export type OnlineVisibilityTab = "PRIVATE" | "PUBLIC";

type Props = {
  value: OnlineVisibilityTab;
  onChange: (next: OnlineVisibilityTab) => void;
};

export function OnlineVisibilityTabs({ value, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div
      role="tablist"
      aria-label={t("korinish_tanlash")}
      className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-line-subtle bg-bg-surface p-1.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "PRIVATE"}
        onClick={() => onChange("PRIVATE")}
        className={`flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
          value === "PRIVATE"
            ? "bg-brand text-bg-base"
            : "bg-transparent text-ink-secondary"
        }`}
      >
        {t("tab_private")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "PUBLIC"}
        onClick={() => onChange("PUBLIC")}
        className={`flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
          value === "PUBLIC"
            ? "bg-brand text-bg-base"
            : "bg-transparent text-ink-secondary"
        }`}
      >
        {t("tab_public")}
      </button>
    </div>
  );
}
