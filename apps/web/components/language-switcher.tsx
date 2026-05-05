"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import {
  type AuthUser,
  getAuthToken,
  getAuthUser,
  setAuthUser,
} from "@/lib/auth";
import { type AppLanguage, useI18n } from "@/lib/i18n";

const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: "uz", label: "UZ" },
  { value: "ru", label: "RU" },
  { value: "en", label: "EN" },
];

export function LanguageSwitcher({
  variant = "pill",
  fullWidth = false,
}: {
  variant?: "pill" | "select" | "segmented";
  fullWidth?: boolean;
}) {
  const { language, setLanguage, t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  async function handleChange(nextLanguage: AppLanguage) {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);

    if (!getAuthToken()) return;

    setSaving(true);
    try {
      const currentUser = getAuthUser();
      const payload = await apiRequest<{ user: AuthUser }>("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          nickname: currentUser?.nickname ?? undefined,
          languageCode: nextLanguage,
        }),
      });
      if (payload.user) {
        setAuthUser(payload.user);
      }
    } catch {
      // Keep the selected language locally even if persistence fails.
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  if (variant === "select") {
    return (
      <label
        className={`inline-flex items-center rounded-full border border-line-strong bg-bg-surface text-sm text-ink-primary ${fullWidth ? "w-full" : ""}`}
        aria-label={t("til")}
        title={t("til")}
      >
        <select
          value={language}
          onChange={(event) =>
            void handleChange(event.target.value as AppLanguage)
          }
          disabled={saving}
          className={`appearance-none rounded-full bg-transparent px-4 py-2.5 text-sm font-semibold uppercase outline-none disabled:opacity-50 ${fullWidth ? "w-full text-center" : ""}`}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (variant === "segmented") {
    return (
      <div
        className={`grid grid-cols-3 gap-2 rounded-2xl border border-line-strong bg-bg-surface p-2 ${fullWidth ? "w-full" : ""}`}
        aria-label={t("til")}
        title={t("til")}
      >
        {LANGUAGE_OPTIONS.map((option) => {
          const active = option.value === language;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => void handleChange(option.value)}
              disabled={saving}
              className={`flex h-12 items-center justify-center rounded-xl text-sm font-semibold transition ${
                active
                  ? "bg-brand text-bg-base"
                  : "border border-line-subtle bg-bg-base text-ink-secondary"
              } disabled:opacity-50`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-line-strong bg-bg-surface p-1 ${fullWidth ? "w-full" : ""}`}
      aria-label={t("til")}
      title={t("til")}
    >
      <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
        {t("til")}
      </span>
      {LANGUAGE_OPTIONS.map((option) => {
        const active = option.value === language;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => void handleChange(option.value)}
            disabled={saving}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              active ? "bg-brand text-bg-base" : "text-ink-secondary"
            } disabled:opacity-50`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
