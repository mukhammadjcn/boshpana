const SESSION_KEY = "bunker-session-id";

export function getOrCreateSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(SESSION_KEY);

  if (existing) {
    return existing;
  }

  const next = window.crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}
