"use client";

import {
  buildTelegramShareUrl,
  buildTelegramStartappLink,
  isInsideTelegram,
  openTelegramLink,
} from "@/lib/telegram";
import { useI18n } from "@/lib/i18n";
import { pushToast } from "@/store/useToastStore";
import { useMemo, useState } from "react";

type LobbyShareActionsProps = {
  roomCode: string;
  inviteUrl: string;
  gameLabel: string;
};

export function LobbyShareActions({
  roomCode,
  inviteUrl,
  gameLabel,
}: LobbyShareActionsProps) {
  const { t } = useI18n();
  const [linkCopied, setLinkCopied] = useState(false);
  const insideTelegram = isInsideTelegram();
  const tgStartappLink = useMemo(
    () => buildTelegramStartappLink(roomCode),
    [roomCode],
  );

  async function handleCopyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1600);
      pushToast({ kind: "success", text: t("Link nusxalandi") });
    } catch {
      pushToast({ kind: "error", text: t("Nusxalab bo'lmadi") });
    }
  }

  function handleTelegramShare() {
    const url = tgStartappLink ?? inviteUrl;
    const shareUrl = buildTelegramShareUrl(
      url,
      t("Jamoaviy.uz — {gameLabel} uchun {roomCode} xonasiga qo'shiling", {
        gameLabel,
        roomCode
      }),
    );
    openTelegramLink(shareUrl);
  }

  return (
    <div className="mt-4 grid gap-2">
      {insideTelegram ? (
        <button
          type="button"
          onClick={handleTelegramShare}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          <TelegramIcon />
          {t("Telegramda ulashish")}
        </button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleTelegramShare}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            <TelegramIcon />
            {t("Telegramda ulashish")}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
              linkCopied
                ? "bg-ok text-bg-base"
                : "border border-line-strong bg-bg-elevated text-ink-primary"
            }`}
            >
              <CopyIcon />
            {linkCopied ? t("Nusxalandi") : t("Linkni nusxalash")}
          </button>
        </div>
      )}
    </div>
  );
}

function TelegramIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M21.9 4.5L18.7 19.8c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 13.1l-4.9-1.5C.1 11.3.1 10.6 1.4 10.1L20.4 2.8c1-.4 1.8.2 1.5 1.7z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
