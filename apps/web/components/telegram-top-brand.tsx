"use client";

import { useEffect, useState } from "react";

import { getTelegramWebApp, isInsideTelegram, isTelegramMobilePlatform } from "@/lib/telegram";
import { useGameBrandStore } from "@/store/useGameBrandStore";

// Telegram safe-area'ning tepa qismiga brand matnini qo'yadi — Telegram
// chrome'i (✕ Yopish, ▼, ⋯) orasida, pastki chegaraga yaqin joyda. O'yin
// ichida "bunker" / "mafia", qolgan barcha sahifalarda "jamoaviy.uz".
//
// Faqat MOBILE Telegram'da (android/ios) ko'rsatiladi — desktop/web Telegram
// o'z title bar'iga ega va brand qatori u bilan to'qnashadi. Joylashuv va
// o'lcham dasyor brand qatori bilan bir xil; rang tizim temasiga mos.
export function TelegramTopBrand() {
  const [topPx, setTopPx] = useState(0);
  const activeGame = useGameBrandStore((s) => s.activeGame);

  useEffect(() => {
    if (!isInsideTelegram() || !isTelegramMobilePlatform()) return;

    const read = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(
        "--tg-safe-top",
      );
      setTopPx(parseFloat(v) || 0);
    };

    read();

    const wa = getTelegramWebApp();
    wa?.onEvent?.("safeAreaChanged", read);
    wa?.onEvent?.("contentSafeAreaChanged", read);
    wa?.onEvent?.("viewportChanged", read);

    return () => {
      wa?.offEvent?.("safeAreaChanged", read);
      wa?.offEvent?.("contentSafeAreaChanged", read);
      wa?.offEvent?.("viewportChanged", read);
    };
  }, []);

  if (!isInsideTelegram() || !isTelegramMobilePlatform() || topPx <= 16) {
    return null;
  }

  const label =
    activeGame === "BUNKER"
      ? "bunker"
      : activeGame === "MAFIA"
        ? "mafia"
        : "jamoaviy.uz";

  return (
    <div
      aria-hidden
      style={{ height: "var(--tg-safe-top, 0px)" }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-end justify-center bg-bg-base pb-[14px]"
    >
      <span
        style={{
          fontFamily: "var(--font-brand), sans-serif",
          WebkitTextStroke: "0.4px #f4a83a",
        }}
        className="text-[16px] uppercase leading-none tracking-[0.10em] text-brand"
      >
        {label}
      </span>
    </div>
  );
}
