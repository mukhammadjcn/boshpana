"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { getAuthUser, setAuthUser, type AuthUser } from "@/lib/auth";

export type AppLanguage = "uz" | "ru" | "en";

type LocaleMessages = Record<string, string>;

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LANGUAGE_STORAGE_KEY = "jamoaviy_language";
const DEFAULT_LANGUAGE: AppLanguage = "uz";

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLanguage(input: string | null | undefined): AppLanguage {
  if (!input) return DEFAULT_LANGUAGE;
  const value = input.toLowerCase();
  if (value.startsWith("ru")) return "ru";
  if (value.startsWith("en")) return "en";
  return "uz";
}

function formatTemplate(
  text: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key])
  );
}

async function loadMessages(language: AppLanguage): Promise<LocaleMessages> {
  switch (language) {
    case "ru":
      return (await import("../messages/ru.json")).default;
    case "en":
      return (await import("../messages/en.json")).default;
    case "uz":
    default:
      return (await import("../messages/uz.json")).default;
  }
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function persistLanguage(language: AppLanguage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  document.cookie = `jamoaviy_language=${language}; path=/; max-age=31536000; samesite=lax`;
}

export function getInitialLanguageFromUser(user: AuthUser | null): AppLanguage {
  return normalizeLanguage(user?.languageCode ?? null);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [messages, setMessages] = useState<LocaleMessages>({});

  useEffect(() => {
    const cachedUser = getAuthUser();
    const userLanguage = getInitialLanguageFromUser(cachedUser);
    const storedLanguage = getStoredLanguage();
    const initial =
      cachedUser?.languageCode != null ? userLanguage : storedLanguage;
    setLanguageState(initial);
    persistLanguage(initial);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  useEffect(() => {
    let active = true;
    void loadMessages(language).then((nextMessages) => {
      if (active) {
        setMessages(nextMessages);
      }
    });
    return () => {
      active = false;
    };
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage);
        persistLanguage(nextLanguage);
        const user = getAuthUser();
        if (user) {
          setAuthUser({ ...user, languageCode: nextLanguage });
        }
      },
      t: (key, vars) => formatTemplate(messages[key] ?? key, vars)
    }),
    [language, messages]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }
  return context;
}

export function translateText(
  _language: AppLanguage,
  key: string,
  vars?: Record<string, string | number>
) {
  return formatTemplate(key, vars);
}
