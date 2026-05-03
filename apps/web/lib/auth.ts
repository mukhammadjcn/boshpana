const TOKEN_KEY = "jamoaviy_token";
const USER_KEY = "jamoaviy_user";
const LEGACY_TOKEN_KEY = "boshpana_token";
const LEGACY_USER_KEY = "boshpana_user";

export type AuthUser = {
  id: string;
  telegramId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  photoUrl: string | null;
  phone: string | null;
  isPremium: boolean;
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(TOKEN_KEY);
  if (current) return current;
  const legacy = window.localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy) {
    window.localStorage.setItem(TOKEN_KEY, legacy);
    return legacy;
  }
  return null;
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_USER_KEY);
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw =
    window.localStorage.getItem(USER_KEY) ??
    window.localStorage.getItem(LEGACY_USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    window.localStorage.setItem(USER_KEY, raw);
    return parsed;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getDisplayName(user: AuthUser | null): string {
  if (!user) return "";
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return user.telegramUsername ?? "Player";
}
