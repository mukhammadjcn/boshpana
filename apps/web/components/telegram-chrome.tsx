"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getTelegramWebApp, setClosingConfirmation } from "@/lib/telegram";

export function TelegramChrome({
  backHref,
  showBackButton = true,
  closingConfirmation = false
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

  useEffect(() => {
    setClosingConfirmation(closingConfirmation);
    return () => setClosingConfirmation(false);
  }, [closingConfirmation]);

  return null;
}
