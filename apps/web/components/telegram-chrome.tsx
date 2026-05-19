"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getTelegramWebApp } from "@/lib/telegram";

// Note: `closingConfirmation` is accepted for backward compatibility but
// no longer drives anything here. The Telegram close confirmation is now
// enabled app-wide in the Telegram init (layout bootstrap script +
// readyExpand), so the old per-screen toggling — which kept *disabling*
// it on plain pages — was removed.
export function TelegramChrome({
  backHref,
  showBackButton = true
}: {
  backHref?: string;
  showBackButton?: boolean;
  closingConfirmation?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const wa = getTelegramWebApp();
    const backButton = wa?.BackButton;
    if (!backButton) return;

    if (!showBackButton) {
      try {
        backButton.hide();
      } catch {
        // ignore
      }
      return;
    }

    const handleBack = () => {
      if (backHref) {
        router.push(backHref as Route);
        return;
      }
      router.back();
    };

    try {
      backButton.show();
      backButton.onClick(handleBack);
    } catch {
      // ignore
    }

    return () => {
      try {
        backButton.offClick(handleBack);
        backButton.hide();
      } catch {
        // ignore
      }
    };
  }, [router, backHref, showBackButton]);

  return null;
}
