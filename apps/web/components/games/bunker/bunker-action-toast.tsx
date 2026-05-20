"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";

export type ActionToastData = {
  id: string;
  playerName: string;
  title: { uz: string; ru: string; en: string };
  receivedAt: number;
};

type Props = {
  toast: ActionToastData | null;
  onDismiss: () => void;
  // Toast ekranda turishi (ms). Default 3500.
  durationMs?: number;
};

/**
 * Birgina kompakt toast — kim qaysi maxsus karta ishlatganini xonadagi
 * barchaga ko'rsatadi. Phase'ga ta'sir qilmaydi; intro/voting modallari
 * va boshqa o'yin holatiga halaqit bermaydi.
 */
export function BunkerActionToast({ toast, onDismiss, durationMs = 3500 }: Props) {
  const { language } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      // Animatsiya tugashi uchun biroz kechikish
      setTimeout(onDismiss, 250);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs, onDismiss]);

  if (!toast) return null;

  const title =
    language === "ru" ? toast.title.ru : language === "en" ? toast.title.en : toast.title.uz;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-safe z-40 flex justify-center px-4 transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-brand/40 bg-bg-surface/95 px-4 py-2 shadow-lg backdrop-blur">
        <span className="text-lg">⚡</span>
        <p className="text-xs">
          <span className="font-semibold text-brand">{toast.playerName}</span>{" "}
          <span className="text-ink-secondary">→</span>{" "}
          <span className="font-medium text-ink-primary">{title}</span>
        </p>
      </div>
    </div>
  );
}
