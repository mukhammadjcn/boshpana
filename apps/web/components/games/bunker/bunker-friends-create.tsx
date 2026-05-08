"use client";

import type { Route } from "next";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { JoinRoomModal } from "@/components/join-room-modal";
import { apiRequest } from "@/lib/api";
import { type AuthUser, getAuthUser, setAuthUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getOrCreateSessionId } from "@/lib/storage";
import { ActiveRoomConflictModal } from "../shared/active-room-conflict-modal";
import {
  parseActiveRoomConflict,
  type ActiveRoomSummary,
} from "../shared/online-room-utils";

type UsageResponse = {
  roomsCreatedLast30d: number;
  roomCreationLimit: number;
  remaining: number;
};

const winnerOptions = [
  { value: 1, label: "1_kishi_label", hint: "klassik_hint" },
  { value: 2, label: "2_kishi_label", hint: "tezroq_hint" },
  { value: 3, label: "3_kishi_label", hint: "yumshoq_hint" },
];

const rules = [
  "bunker_qoida_1",
  "bunker_qoida_2",
  "bunker_qoida_3",
  "bunker_qoida_4",
];

export function BunkerFriendsCreate() {
  const { t } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [hostName, setHostName] = useState("");
  const [winnerTarget, setWinnerTarget] = useState(2);
  const [isAdult, setIsAdult] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ActiveRoomSummary | null>(null);

  useEffect(() => {
    const cached = getAuthUser();
    setUser(cached);
    const fallback =
      cached?.nickname ?? cached?.firstName ?? cached?.telegramUsername ?? "";
    if (fallback) setHostName((current) => current || fallback);
    let active = true;
    void (async () => {
      try {
        const [meRes, usageRes] = await Promise.all([
          apiRequest<{ user: AuthUser }>("/api/auth/me"),
          apiRequest<UsageResponse>("/api/me/usage"),
        ]);
        if (!active) return;
        setUser(meRes.user);
        setAuthUser(meRes.user);
        setUsage(usageRes);
        const next =
          meRes.user.nickname ??
          meRes.user.firstName ??
          meRes.user.telegramUsername ??
          "";
        if (next) setHostName((current) => current || next);
      } catch {
        // keep cached values
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const limitReached = !!usage && usage.remaining <= 0;

  async function submitCreate(confirmLeaveExisting = false) {
    if (limitReached) return;
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    setCreating(true);
    setCreateError(null);
    try {
      const sessionId = getOrCreateSessionId();
      const response = await apiRequest<{ roomCode: string }>(
        "/api/rooms/create",
        {
          method: "POST",
          body: JSON.stringify({
            hostName: hostName.trim(),
            sessionId,
            winnerTarget,
            isAdult,
            ...(confirmLeaveExisting ? { confirmLeaveExisting: true } : {}),
          }),
        },
      );
      router.push(`/room/${response.roomCode}` as Route);
    } catch (error) {
      const conflict = parseActiveRoomConflict(error);
      if (conflict) {
        setActiveRoom(conflict.activeRoom);
        return;
      }
      setCreateError((error as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCreate(false);
  }

  return (
    <>
      <section className="mt-2 flex-1 pb-10 lg:mt-6">
        {/* Game banner — same artwork as the dashboard card so the
            detail page feels like a continuation, not a separate
            context. Aspect ratio kept landscape for desktop weight. */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-line-subtle bg-bg-surface">
          <Image
            src="/bunker/banner.webp"
            alt={t("bunker_banner")}
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-bg-base/10 to-transparent" />
        </div>

        <h1 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
          {t("bunker_kim_omon_qoladi")}
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {t("3_16_oyinchi_30_60_d1dc")}
        </p>

        <div className="mt-6 grid gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-4">
          <p className="text-sm font-medium uppercase tracking-wider text-brand">
            {t("qoidalar")}
          </p>
          <ul className="grid gap-2 text-sm text-ink-secondary">
            {rules.map((rule, index) => (
              <li key={index} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {index + 1}
                </span>
                <span>{t(rule)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 rounded-2xl border border-line-subtle bg-bg-surface px-4 py-3 text-sm leading-relaxed text-ink-secondary">
          {t("friends_mode_tavsifi")}
        </div>

        {usage && limitReached && (
          <div className="mt-4 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold text-ink-primary">
                {t("oylik_limit")}
              </p>
              <p
                className={`text-sm font-mono ${limitReached ? "text-bad" : "text-brand"}`}
              >
                {usage.remaining}/{usage.roomCreationLimit}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className={`h-full ${limitReached ? "bg-bad" : "bg-brand"}`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((usage.roomCreationLimit - usage.remaining) /
                        usage.roomCreationLimit) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-bad">
              {t("limit_tugagan_keyingi_davrigacha_kuting")}
            </p>
          </div>
        )}

        <form
          onSubmit={handleCreate}
          className="mt-4 grid gap-4 rounded-2xl border border-line-subtle bg-bg-surface p-4"
        >
          {/* <p className="text-xs font-medium uppercase tracking-wider text-brand">
            {t("yangi_lobby")}
          </p> */}

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t("nickname")}
            </span>
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              required
              maxLength={20}
              className="h-12 w-full rounded-xl border border-line-strong bg-bg-base px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
              placeholder={t("masalan_alisher")}
            />
          </label>

          <div className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t("oyin_nechta_odam_qolganda_tugaydi")}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {winnerOptions.map((option) => {
                const active = winnerTarget === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setWinnerTarget(option.value)}
                    aria-pressed={active}
                    className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                      active
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-line-strong bg-bg-base text-ink-secondary"
                    }`}
                  >
                    <span className="text-sm font-semibold">
                      {t(option.label)}
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      {t(option.hint)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t("mavzu")}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsAdult(false)}
                aria-pressed={!isAdult}
                className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                  !isAdult
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line-strong bg-bg-base text-ink-secondary"
                }`}
              >
                <span className="text-sm font-semibold">{t("normal")}</span>
                <span className="text-[11px] text-ink-muted">
                  {t("hamma_uchun_tavsif")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdult(true);
                }}
                aria-pressed={isAdult}
                className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                  isAdult
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line-strong bg-bg-base text-ink-secondary"
                }`}
              >
                <span className="text-sm font-semibold">18+</span>
                <span className="text-[11px] text-ink-muted">
                  {t("aralash_kartalar_tavsif")}
                </span>
              </button>
            </div>
          </div>

          {createError ? (
            <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              {createError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={creating || limitReached || !hostName.trim()}
            className={`flex h-14 items-center justify-center rounded-xl text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
              limitReached
                ? "bg-bg-elevated text-ink-muted"
                : "bg-brand text-bg-base"
            }`}
          >
            {creating
              ? t("yaratilmoqda")
              : limitReached
                ? t("limit_tugagan")
                : t("oyin_yaratish")}
          </button>

          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="flex h-14 w-full items-center justify-center rounded-xl border border-line-strong bg-bg-surface text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
          >
            {t("kod_orqali_qoshilish")}
          </button>
        </form>
      </section>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />

      <ActiveRoomConflictModal
        activeRoom={activeRoom}
        open={!!activeRoom}
        busy={creating}
        onContinue={() => {
          if (!activeRoom) return;
          router.push(`/room/${activeRoom.code}` as Route);
        }}
        onStartNew={() => {
          setActiveRoom(null);
          void submitCreate(true);
        }}
      />
    </>
  );
}
