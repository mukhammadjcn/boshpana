"use client";

import { useEffect, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";
import {
  type AuthUser,
  getAuthToken,
  setAuthToken,
  setAuthUser
} from "@/lib/auth";
import {
  applyTelegramSafeAreas,
  getTelegramStartParam,
  readyExpand,
  requestContactPhone,
  waitForTelegramWebApp
} from "@/lib/telegram";

function resolveStartParamPath(): string | null {
  const param = getTelegramStartParam();
  if (!param) return null;
  // Accept either a bare room code or `room_<code>` style payloads.
  const code = param.replace(/^room[_-]?/i, "").toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return null;
  return `/room/${code}`;
}

function navigateAfterAuth() {
  if (typeof window === "undefined") return;
  // Authenticated users always land inside the dashboard shell — never
  // back on the public landing page.
  const target = resolveStartParamPath() ?? "/dashboard";
  window.location.replace(target);
}

type LoginResponse =
  | { token: string; user: AuthUser }
  | { requiresPhone: true; user: AuthUser };

type Stage =
  | { kind: "loading"; message: string }
  | { kind: "outside" }
  | { kind: "error"; message: string }
  | { kind: "needs-phone" }
  | { kind: "submitting-phone" };

export function TelegramAuthGate() {
  const [stage, setStage] = useState<Stage>({
    kind: "loading",
    message: "Yuklanmoqda..."
  });
  const initDataRef = useRef<string>("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void (async () => {
      const wa = await waitForTelegramWebApp();
      if (wa) {
        readyExpand();
        applyTelegramSafeAreas();
      }

      // Already authenticated — straight to destination.
      if (getAuthToken()) {
        navigateAfterAuth();
        return;
      }

      // Not in Telegram — this entry is only for the WebApp. Bounce browser
      // visitors to the regular landing page instead of leaving them stuck
      // on a loader.
      if (!wa || !wa.initData) {
        setStage({ kind: "outside" });
        if (typeof window !== "undefined") {
          window.location.replace("/");
        }
        return;
      }

      setStage({ kind: "loading", message: "Hisobingiz tekshirilmoqda..." });
      initDataRef.current = wa.initData;

      try {
        const res = await apiRequest<LoginResponse>(
          "/api/auth/telegram-webapp",
          {
            method: "POST",
            body: JSON.stringify({ initData: wa.initData })
          }
        );
        if ("token" in res) {
          setAuthToken(res.token);
          setAuthUser(res.user);
          navigateAfterAuth();
        } else {
          setAuthUser(res.user);
          setStage({ kind: "needs-phone" });
        }
      } catch (error) {
        setStage({
          kind: "error",
          message: (error as Error).message
        });
      }
    })();
  }, []);

  async function handleSharePhone() {
    setStage({ kind: "submitting-phone" });
    const phone = await requestContactPhone();
    if (!phone) {
      setStage({ kind: "needs-phone" });
      return;
    }
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>(
        "/api/auth/telegram-webapp/phone",
        {
          method: "POST",
          body: JSON.stringify({
            initData: initDataRef.current,
            phone
          })
        }
      );
      setAuthToken(res.token);
      setAuthUser(res.user);
      navigateAfterAuth();
    } catch (error) {
      setStage({
        kind: "error",
        message: (error as Error).message
      });
    }
  }

  if (stage.kind === "loading" || stage.kind === "outside") {
    return (
      <main className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg-base px-6 text-ink-primary">
        <div
          className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl bg-cover bg-center shadow-pop"
          style={{ backgroundImage: "url(/banner.png)" }}
          aria-hidden
        >
          <div className="absolute inset-0 bg-bg-base/40" />
          <span className="relative grid h-12 w-12 place-items-center rounded-full bg-bg-base/85 text-2xl font-bold text-brand">
            B
          </span>
        </div>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.3em] text-brand">
          Boshpana
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-secondary">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          {stage.kind === "outside"
            ? "Telegram aniqlanmadi, sayt sahifasiga yo'naltirilmoqda..."
            : stage.message}
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-[100] flex items-end justify-center bg-bg-base px-5 sm:items-center">
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border-t border-line-subtle bg-bg-surface p-6 pb-safe shadow-pop sm:rounded-3xl sm:border">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
          Boshpana
        </p>
        {stage.kind === "needs-phone" || stage.kind === "submitting-phone" ? (
          <>
            <h2 className="mt-1 text-2xl font-bold">
              Telefon raqamingizni ulashing
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Davom etish uchun Telegram orqali telefon raqamingizni
              ulashishingiz kerak. Bu bir martalik amal — keyingi safar
              avtomatik kirib turasiz.
            </p>
            <button
              disabled={stage.kind === "submitting-phone"}
              onClick={handleSharePhone}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
            >
              {stage.kind === "submitting-phone"
                ? "Yuklanmoqda..."
                : "Telefon raqamni ulashish"}
            </button>
          </>
        ) : null}
        {stage.kind === "error" ? (
          <>
            <h2 className="mt-1 text-2xl font-bold">Avtorizatsiya xatosi</h2>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              {stage.message}
            </p>
            <button
              onClick={() => {
                ranRef.current = false;
                setStage({ kind: "loading", message: "Qayta urinilmoqda..." });
                window.location.reload();
              }}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-elevated text-sm font-semibold"
            >
              Qayta urinish
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}
