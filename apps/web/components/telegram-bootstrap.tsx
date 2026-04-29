"use client";

import { useEffect } from "react";

import {
  applyTelegramSafeAreas,
  readyExpand,
  waitForTelegramWebApp
} from "@/lib/telegram";

// Runs on every page in case the user lands deep inside the SPA (e.g.
// refreshes /room/CODE while in WebApp). Only handles safe areas + ready
// — NOT auth. Auth flow lives on the dedicated /telegram entry page so
// we don't bother browser visitors with a Telegram check.
export function TelegramBootstrap() {
  useEffect(() => {
    void (async () => {
      const wa = await waitForTelegramWebApp(2000);
      if (!wa) return;
      readyExpand();
      applyTelegramSafeAreas();
    })();
  }, []);

  return null;
}
