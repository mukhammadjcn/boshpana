"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";

const MODAL_DELAY_MS = 8000;
const RECONNECT_INTERVAL_MS = 2500;
const REFRESH_INTERVAL_MS = 5000;
const REFRESH_AFTER_RECONNECT_MS = 450;

type RealtimeRecoveryOptions = {
  enabled: boolean;
  connected: boolean;
  onReconnect: () => void;
  onRefreshState?: () => void;
};

export function useRealtimeConnectionRecovery({
  enabled,
  connected,
  onReconnect,
  onRefreshState
}: RealtimeRecoveryOptions) {
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const triggerRecovery = useCallback((assumeOnline = browserOnline) => {
    if (!enabled) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    if (!assumeOnline) return;
    onReconnect();
    if (!onRefreshState) return;
    window.setTimeout(() => {
      onRefreshState();
    }, REFRESH_AFTER_RECONNECT_MS);
  }, [browserOnline, enabled, onReconnect, onRefreshState]);

  useEffect(() => {
    if (!enabled) return;

    const handleOnline = () => {
      setBrowserOnline(true);
      triggerRecovery(true);
    };
    const handleOffline = () => {
      setBrowserOnline(false);
    };
    const handleVisible = () => {
      if (document.visibilityState !== "visible") return;
      const nextOnline = navigator.onLine;
      setBrowserOnline(nextOnline);
      triggerRecovery(nextOnline);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleVisible);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleVisible);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [enabled, triggerRecovery]);

  useEffect(() => {
    if (!enabled) {
      setShowRecoveryModal(false);
      return;
    }
    if (connected) {
      setShowRecoveryModal(false);
      return;
    }

    triggerRecovery();

    const modalTimer = window.setTimeout(() => {
      setShowRecoveryModal(true);
    }, MODAL_DELAY_MS);
    const reconnectTimer = window.setInterval(() => {
      triggerRecovery();
    }, RECONNECT_INTERVAL_MS);
    const refreshTimer = onRefreshState
      ? window.setInterval(() => {
          if (!browserOnline) return;
          if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            return;
          }
          onRefreshState();
        }, REFRESH_INTERVAL_MS)
      : null;

    return () => {
      window.clearTimeout(modalTimer);
      window.clearInterval(reconnectTimer);
      if (refreshTimer != null) {
        window.clearInterval(refreshTimer);
      }
    };
  }, [browserOnline, connected, enabled, onRefreshState, triggerRecovery]);

  const retryNow = useCallback(() => {
    triggerRecovery();
  }, [triggerRecovery]);

  const reloadPage = useCallback(() => {
    window.location.reload();
  }, []);

  return {
    browserOnline,
    showRecoveryModal: enabled && !connected && showRecoveryModal,
    retryNow,
    reloadPage
  };
}

type RealtimeConnectionFeedbackProps = {
  connected: boolean;
  browserOnline: boolean;
  showRecoveryModal: boolean;
  onRetryNow: () => void;
  onReloadPage: () => void;
};

export function RealtimeConnectionFeedback({
  connected,
  browserOnline,
  showRecoveryModal,
  onRetryNow,
  onReloadPage
}: RealtimeConnectionFeedbackProps) {
  const { t } = useI18n();

  return (
    <>
      {!connected ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 grid place-items-center pt-safe">
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/20 px-3 py-1 text-xs font-medium text-warn shadow-pop backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
            {browserOnline
              ? t("qayta_ulanmoqda")
              : t("internet_ulanishi_topilmadi")}
          </div>
        </div>
      ) : null}

      {showRecoveryModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-bg-overlay/90 px-4 backdrop-blur-md sm:items-center"
        >
          <div className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-line-strong bg-bg-surface shadow-pop sm:rounded-3xl">
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

            <div className="px-6 pt-6 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-warn/35 bg-warn/10 text-warn">
                <svg
                  width="38"
                  height="38"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M8.5 16.5a5 5 0 0 1 7 0" />
                  <path d="M5 13a10 10 0 0 1 14 0" />
                  <path d="M2 9.5a15 15 0 0 1 20 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              </div>

              <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-warn">
                {browserOnline ? t("tarmoqdan_tushgan") : t("tarmoqda_emas")}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-ink-primary">
                {browserOnline
                  ? t("server_bilan_aloqa_uzildi")
                  : t("internet_ulanishi_topilmadi")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                {browserOnline
                  ? t("serverga_qayta_ulanishga_harakat_qilyapmiz")
                  : t("internet_qaytgach_tizim_ozi_qayta_ulanadi")}
              </p>
            </div>

            <div className="grid gap-3 px-5 pt-5 pb-5">
              <button
                type="button"
                onClick={browserOnline ? onRetryNow : onReloadPage}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
              >
                {browserOnline ? t("qayta_urinish") : t("sahifani_yangilash")}
              </button>
              <button
                type="button"
                onClick={browserOnline ? onReloadPage : onRetryNow}
                className="flex h-14 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-base text-base font-semibold text-ink-primary transition active:scale-[0.98]"
              >
                {browserOnline ? t("sahifani_yangilash") : t("qayta_urinish")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
