import { clearAuthToken, getAuthToken } from "./auth";
import { getStoredLanguage } from "./i18n";
import { reauthFromTelegram } from "./reauth";
import { isInsideTelegram } from "./telegram";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ApiRequestInit = RequestInit & {
  // Set to false on a non-idempotent endpoint to skip the auto-retry
  // safety net (e.g. POST /rooms/create — retrying could create dupes).
  retry?: boolean;
  // Internal: set once we've already re-authenticated for this call so a
  // second 401 can't loop forever. Callers never pass this.
  _reauthed?: boolean;
};

const RETRY_DELAYS_MS = [200, 600];

// The login endpoints themselves must never trigger a re-auth on 401 —
// that's where the credentials are actually being checked.
const NO_REAUTH_PATHS = [
  "/api/auth/telegram-webapp",
  "/api/auth/dev-login",
  "/api/auth/bot-session",
];

function isIdempotentMethod(method: string | undefined) {
  if (!method) return true;
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

export async function apiRequest<T>(
  path: string,
  init?: ApiRequestInit
): Promise<T> {
  const token = getAuthToken();
  const language = getStoredLanguage();
  const headers = {
    "Content-Type": "application/json",
    "X-Language": language,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers ?? {})
  };
  // Auto-retry only the cases that are safe to repeat: idempotent methods
  // by default, unless the caller explicitly opts out (or in for a known-
  // safe POST). Mutations like room create/join must NOT auto-retry.
  const allowRetry =
    init?.retry !== undefined
      ? init.retry
      : isIdempotentMethod(init?.method);

  let lastError: unknown = null;
  const attempts = allowRetry ? RETRY_DELAYS_MS.length + 1 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
        cache: "no-store"
      });
      if (response.ok) {
        return (await response.json()) as T;
      }
      const payload = await response
        .json()
        .catch(() => ({ message: "Xatolik yuz berdi." }));
      const error = new Error(
        payload.message ?? "Xatolik yuz berdi."
      ) as Error & {
        status?: number;
        code?: string;
        payload?: unknown;
      };
      error.status = response.status;
      error.code =
        typeof payload.code === "string" ? payload.code : undefined;
      error.payload = payload;

      // Stale/expired JWT — the token in localStorage no longer verifies.
      // Telegram's initData is always fresh, so silently mint a new token
      // and replay the request once. A 401 means the call never executed
      // server-side, so replaying is safe even for mutations.
      if (
        response.status === 401 &&
        !init?._reauthed &&
        !NO_REAUTH_PATHS.some((p) => path.startsWith(p))
      ) {
        const newToken = await reauthFromTelegram();
        if (newToken) {
          return apiRequest<T>(path, { ...init, _reauthed: true });
        }
        // Couldn't recover (outside Telegram or initData rejected). Drop the
        // dead token so we stop trusting it, and bounce back through the
        // Telegram login gate to mint a fresh session.
        clearAuthToken();
        if (typeof window !== "undefined" && isInsideTelegram()) {
          window.location.replace("/telegram");
        }
      }

      // Only 5xx is retryable; 4xx is the caller's problem and won't get
      // better with a retry.
      if (allowRetry && response.status >= 500 && attempt < attempts - 1) {
        lastError = error;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw error;
    } catch (error) {
      // Network-level failure (DNS, offline, abort). Retry if allowed.
      const isResponseError =
        error instanceof Error && "status" in error;
      if (!isResponseError && allowRetry && attempt < attempts - 1) {
        lastError = error;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Xatolik yuz berdi.");
}
