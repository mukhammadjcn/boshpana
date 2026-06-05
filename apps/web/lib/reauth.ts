"use client";

import {
  type AuthUser,
  setAuthToken,
  setAuthUser,
} from "./auth";
import { getTelegramWebApp } from "./telegram";

// Telegram's WebApp object hands us a FRESH initData on every open — it is
// never persisted and never goes stale. So whenever our cached JWT is
// rejected (401), we can silently mint a new token straight from initData,
// the same way dasyor uses a refresh token. This is the single recovery
// path that keeps the session alive no matter which URL the Mini App opened
// at (root, /dashboard, a deep link) — not just the /telegram gate.

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Dedupe concurrent recoveries: a page that fires several requests at once
// would otherwise trigger a login round-trip per 401. They all share one.
let reauthPromise: Promise<string | null> | null = null;

export function reauthFromTelegram(): Promise<string | null> {
  if (reauthPromise) return reauthPromise;
  reauthPromise = (async () => {
    try {
      const wa = getTelegramWebApp();
      const initData = wa?.initData?.trim();
      // Outside Telegram there is no initData to re-auth with — caller falls
      // back to clearing the token / bouncing to the login flow.
      if (!initData) return null;

      const res = await fetch(`${API_BASE_URL}/api/auth/telegram-webapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
        cache: "no-store",
      });
      if (!res.ok) return null;

      const data = (await res.json().catch(() => null)) as
        | { token?: string; user?: AuthUser }
        | null;
      if (data && typeof data.token === "string") {
        setAuthToken(data.token);
        if (data.user) setAuthUser(data.user);
        return data.token;
      }
      // requiresPhone or an unexpected shape — can't produce a token here.
      return null;
    } catch {
      return null;
    } finally {
      reauthPromise = null;
    }
  })();
  return reauthPromise;
}
