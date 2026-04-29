"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { apiRequest } from "@/lib/api";
import {
  type AuthUser,
  clearAuthToken,
  getAuthToken,
  getAuthUser,
  setAuthUser
} from "@/lib/auth";
import { isInsideTelegram } from "@/lib/telegram";

export function ProfileView() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [canLogout, setCanLogout] = useState(false);

  useEffect(() => {
    setCanLogout(!isInsideTelegram());
  }, []);

  function handleLogout() {
    if (!confirm("Tizimdan chiqishni xohlaysizmi?")) return;
    clearAuthToken();
    router.replace("/" as Route);
    if (typeof window !== "undefined") window.location.reload();
  }

  useEffect(() => {
    if (!getAuthToken()) {
      setAuthReady(false);
      return;
    }
    setAuthReady(true);
    let active = true;
    void (async () => {
      try {
        const res = await apiRequest<{ user: AuthUser }>("/api/auth/me");
        if (!active) return;
        setUser(res.user);
        setNickname(res.user.nickname ?? "");
        setAuthUser(res.user);
      } catch {
        if (active) {
          // fall back to cached
          const cached = getAuthUser();
          if (cached) {
            setUser(cached);
            setNickname(cached.nickname ?? "");
          }
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setMessage({ kind: "error", text: "Nickname bo'sh bo'lmasin." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ user: AuthUser }>(
        "/api/me/profile",
        {
          method: "PATCH",
          body: JSON.stringify({ nickname: trimmed })
        }
      );
      setUser(res.user);
      setAuthUser(res.user);
      setMessage({ kind: "ok", text: "Saqlandi." });
    } catch (error) {
      setMessage({ kind: "error", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pt-6 pb-safe">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-brand">
          Profil
        </p>
        <h1 className="mt-1 text-2xl font-bold">Mening profilim</h1>
      </header>

      {!authReady ? (
        <div className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface p-5 text-sm text-ink-secondary">
          Profilni ko'rish uchun avval Telegram orqali tizimga kiring.
        </div>
      ) : !user ? (
        <div className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface p-5 text-sm text-ink-secondary">
          Yuklanmoqda...
        </div>
      ) : (
        <>
          <section className="mt-6 flex items-center gap-4 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            {user.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-lg font-semibold text-brand">
                {(user.firstName ?? user.telegramUsername ?? "?")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">
                {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                  user.telegramUsername ||
                  "—"}
              </p>
              <p className="text-xs text-ink-secondary">
                {user.telegramUsername ? `@${user.telegramUsername}` : ""}
              </p>
              {user.phone ? (
                <p className="mt-1 text-xs text-ink-muted">{user.phone}</p>
              ) : null}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              Nickname
            </label>
            <p className="mt-1 text-xs text-ink-secondary">
              Bu nick o'yinlarga qo'shilganda default ishlatiladi.
            </p>
            <input
              value={nickname}
              maxLength={32}
              onChange={(e) => setNickname(e.target.value)}
              className="mt-3 h-12 w-full rounded-xl border border-line-strong bg-bg-base px-4 text-base"
              placeholder="Nickname"
            />
            <button
              onClick={save}
              disabled={saving || nickname.trim() === (user.nickname ?? "")}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-bg-base disabled:opacity-50"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
            {message ? (
              <p
                className={`mt-2 text-xs ${message.kind === "ok" ? "text-ok" : "text-bad"}`}
              >
                {message.text}
              </p>
            ) : null}
          </section>

          <section className="mt-4">
            <Link
              href={"/dashboard/games" as Route}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-line-strong bg-bg-elevated text-sm font-semibold"
            >
              Mening o'yinlarim →
            </Link>
          </section>

          {canLogout ? (
            <section className="mt-6">
              <button
                onClick={handleLogout}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad transition active:scale-[0.99]"
              >
                Tizimdan chiqish
              </button>
            </section>
          ) : null}
        </>
      )}
      <BottomNav />
    </main>
  );
}
