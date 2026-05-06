"use client";

import { useI18n } from "@/lib/i18n";

export type CreateTabMode = "friends" | "online";

type Props = {
  value: CreateTabMode;
  onChange: (next: CreateTabMode) => void;
};

export function CreatePageTabs({ value, onChange }: Props) {
  const { t } = useI18n();
  return (
    <div
      role="tablist"
      aria-label={t("rejim_tanlash")}
      className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-line-subtle bg-bg-surface p-1.5"
    >
      <TabButton
        active={value === "friends"}
        onClick={() => onChange("friends")}
        label={t("tab_dostlar_davrasi")}
      />
      <TabButton
        active={value === "online"}
        onClick={() => onChange("online")}
        label={t("tab_online")}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
        active
          ? "bg-brand text-bg-base"
          : "bg-transparent text-ink-secondary"
      }`}
    >
      {label}
    </button>
  );
}
