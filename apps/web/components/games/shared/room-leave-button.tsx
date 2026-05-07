"use client";

import { useI18n } from "@/lib/i18n";

type RoomLeaveButtonProps = {
  onClick: () => void;
  className?: string;
};

export function RoomLeaveButton({
  onClick,
  className = "",
}: RoomLeaveButtonProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("roomdan_chiqish")}
      className={`flex h-[30px] items-center justify-center gap-1 rounded-full border border-bad/40 bg-bad/10 px-3 text-xs font-semibold text-bad ${className}`.trim()}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    </button>
  );
}
