type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
};

type TgContact = {
  user_id?: number;
  phone_number: string;
  first_name?: string;
  last_name?: string;
};

type TgInset = { top?: number; bottom?: number; left?: number; right?: number };

type TgWebApp = {
  initData: string;
  initDataUnsafe?: { user?: TgUser; start_param?: string };
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: TgInset;
  contentSafeAreaInset?: TgInset;
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  onEvent?: (event: string, cb: () => void) => void;
  offEvent?: (event: string, cb: () => void) => void;
  requestContact?: (
    callback: (shared: boolean, response?: { responseUnsafe?: { contact?: TgContact } }) => void
  ) => void;
  openTelegramLink?: (url: string) => void;
  MainButton?: {
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export function getTelegramWebApp(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function isInsideTelegram(): boolean {
  const wa = getTelegramWebApp();
  return !!wa && !!wa.initData;
}

export async function waitForTelegramWebApp(
  timeoutMs = 5000
): Promise<TgWebApp | null> {
  if (typeof window === "undefined") return null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const wa = getTelegramWebApp();
    if (wa && wa.initData) return wa;
    await new Promise((r) => setTimeout(r, 150));
  }
  return getTelegramWebApp();
}

export function readyExpand() {
  const wa = getTelegramWebApp();
  if (!wa) return;
  try {
    wa.ready();
    wa.expand();
    // Match the app's themeColor so the Telegram header doesn't visually
    // separate from the page background.
    wa.setHeaderColor?.("#0b0d12");
    wa.setBackgroundColor?.("#0b0d12");
    wa.setBottomBarColor?.("#0b0d12");
  } catch {
    // ignore
  }
}

// Push Telegram-provided insets into CSS custom properties. Matches the
// pattern used in dasyor: safeAreaInset (device — notch / home indicator)
// and contentSafeAreaInset (Telegram's own chrome — header, bottom bar)
// stack additively, since they cover separate layers.
export function applyTelegramSafeAreas() {
  const wa = getTelegramWebApp();
  if (!wa || typeof document === "undefined") return;

  const update = () => {
    const sa = wa.safeAreaInset ?? {};
    const csa = wa.contentSafeAreaInset ?? {};
    const top = (sa.top ?? 0) + (csa.top ?? 0);
    const bottom = (sa.bottom ?? 0) + (csa.bottom ?? 0);
    const left = (sa.left ?? 0) + (csa.left ?? 0);
    const right = (sa.right ?? 0) + (csa.right ?? 0);
    const root = document.documentElement;
    root.style.setProperty("--tg-safe-top", `${top}px`);
    root.style.setProperty("--tg-safe-bottom", `${bottom}px`);
    root.style.setProperty("--tg-safe-left", `${left}px`);
    root.style.setProperty("--tg-safe-right", `${right}px`);
    if (typeof wa.viewportStableHeight === "number") {
      root.style.setProperty(
        "--tg-viewport-height",
        `${wa.viewportStableHeight}px`
      );
    }
  };

  update();
  try {
    wa.onEvent?.("safeAreaChanged", update);
    wa.onEvent?.("contentSafeAreaChanged", update);
    wa.onEvent?.("viewportChanged", update);
  } catch {
    // ignore — older clients
  }
}

export async function requestContactPhone(): Promise<string | null> {
  const wa = getTelegramWebApp();
  if (!wa?.requestContact) return null;
  return new Promise((resolve) => {
    try {
      wa.requestContact!((shared, response) => {
        if (!shared) {
          resolve(null);
          return;
        }
        const phone = response?.responseUnsafe?.contact?.phone_number ?? null;
        resolve(phone);
      });
    } catch {
      resolve(null);
    }
  });
}

export function openTelegramLink(url: string) {
  const wa = getTelegramWebApp();
  if (wa?.openTelegramLink) {
    wa.openTelegramLink(url);
    return;
  }
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
}

export const TG_BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
export const TG_WEB_APP_NAME =
  process.env.NEXT_PUBLIC_TELEGRAM_WEB_APP_NAME ?? "";

// Build a Telegram deep link that opens the Mini App with a `startapp`
// parameter. Inside the WebApp the param surfaces as
// `Telegram.WebApp.initDataUnsafe.start_param` so we can route the user
// straight to the relevant room.
export function buildTelegramStartappLink(startParam: string): string | null {
  if (!TG_BOT_USERNAME) return null;
  const param = encodeURIComponent(startParam);
  if (TG_WEB_APP_NAME) {
    return `https://t.me/${TG_BOT_USERNAME}/${TG_WEB_APP_NAME}?startapp=${param}`;
  }
  return `https://t.me/${TG_BOT_USERNAME}?startapp=${param}`;
}

export function buildTelegramShareUrl(url: string, text?: string): string {
  const base = `https://t.me/share/url?url=${encodeURIComponent(url)}`;
  return text ? `${base}&text=${encodeURIComponent(text)}` : base;
}

export function getTelegramStartParam(): string | null {
  const wa = getTelegramWebApp();
  return wa?.initDataUnsafe?.start_param ?? null;
}
