"use client";

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n";

export type ActionToastData = {
  id: string;
  playerName: string;
  title: { uz: string; ru: string; en: string };
  description: { uz: string; ru: string; en: string };
  isSystem?: boolean;
  receivedAt: number;
};

type Props = {
  toast: ActionToastData | null;
  onDismiss: () => void;
  // Toast ekranda turishi (ms). Default 3500.
  durationMs?: number;
};

/**
 * Toast/banner — kim qaysi maxsus karta ishlatganini va u nima qila olishini
 * xonadagi barchaga ko'rsatadi. Phase'ga ta'sir qilmaydi.
 *
 * Format: "{kim} ⚡ {karta nomi}" + {tavsifi} — o'yinchilar effektni tushunsin.
 */
export function BunkerActionToast({ toast, onDismiss, durationMs = 5000 }: Props) {
  const { t, language } = useI18n();
  const [visible, setVisible] = useState(false);

  // onDismiss inline arrow function — parent har render'da yangi reference
  // beradi. Effect deps ichida bo'lsa, har socket update'da timer reset
  // bo'lardi va toast hech qachon yo'qolmas edi. Ref orqali stabilashtiramiz.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismissRef.current(), 250);
    }, durationMs);
    return () => clearTimeout(timer);
    // Faqat toast.id'ga bog'lanamiz — yangi action kelganda timer qaytadan
    // boshlanadi, boshqa render'larda tegmaydi.
  }, [toast?.id, durationMs]);

  if (!toast) return null;

  const pick = (text: { uz: string; ru: string; en: string }) =>
    language === "ru" ? text.ru : language === "en" ? text.en : text.uz;

  const title = pick(toast.title);
  const description = pick(toast.description);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4 transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-brand/40 bg-bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex items-start gap-2">
          <span className="text-xl leading-none">⚡</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-tight">
              {!toast.isSystem ? (
                <>
                  <span className="font-semibold text-brand">
                    {toast.playerName}
                  </span>{" "}
                  <span className="text-ink-muted">
                    {t("ishlatdi") ?? "ishlatdi"}:
                  </span>{" "}
                </>
              ) : null}
              <span className="font-semibold text-ink-primary">{title}</span>
            </p>
            {description ? (
              <p className="mt-0.5 text-[11px] leading-snug text-ink-secondary">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
