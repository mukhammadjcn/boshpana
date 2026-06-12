"use client";

import { useEffect, useState } from "react";

import { isInsideTelegram, isTelegramMobilePlatform } from "@/lib/telegram";

// True only once mounted inside the mobile Telegram Mini App (android/ios).
// Starts false so SSR and the first client render match (avoids hydration
// mismatch); flips true after mount. Use to scope Telegram-only chrome —
// e.g. hide an in-page back button/title that the native Telegram back +
// top branding already cover, while a regular browser keeps them.
export function useIsTelegramMobile(): boolean {
  const [isTgMobile, setIsTgMobile] = useState(false);

  useEffect(() => {
    setIsTgMobile(isInsideTelegram() && isTelegramMobilePlatform());
  }, []);

  return isTgMobile;
}
