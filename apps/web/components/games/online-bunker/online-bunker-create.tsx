"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { apiRequest } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getOrCreateSessionId } from "@/lib/storage";
import { ActiveRoomConflictModal } from "../shared/active-room-conflict-modal";
import {
  OnlineVisibilityTabs,
  type OnlineVisibilityTab,
} from "../shared/online-visibility-tabs";
import {
  buildMatchmakeBody,
  buildOnlineCreateRoomBody,
  parseActiveRoomConflict,
  type ActiveRoomSummary,
} from "../shared/online-room-utils";
import { JoinRoomModal } from "@/components/join-room-modal";

type CreateResponse = {
  roomCode: string;
};

type MatchmakeResponse = {
  roomCode: string;
  isNew: boolean;
};

type RetryIntent =
  | { kind: "create"; isAdult: boolean; winnerTarget: number }
  | { kind: "matchmake"; isAdult: boolean }
  | null;

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

export function OnlineBunkerCreate() {
  const router = useRouter();
  const { t } = useI18n();
  const [visibility, setVisibility] = useState<OnlineVisibilityTab>("PUBLIC");
  const [hostName, setHostName] = useState("");
  const [winnerTarget, setWinnerTarget] = useState(2);
  const [isAdult, setIsAdult] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<ActiveRoomSummary | null>(null);
  const [retryIntent, setRetryIntent] = useState<RetryIntent>(null);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    const authUser = getAuthUser();
    const fallback =
      authUser?.nickname ??
      authUser?.firstName ??
      authUser?.telegramUsername ??
      "";
    if (fallback) {
      setHostName((current) => current || fallback);
    }
  }, []);

  async function submitCreate(confirmLeaveExisting = false) {
    setSubmitting(true);
    setError(null);
    const sessionId = getOrCreateSessionId();

    try {
      const response = await apiRequest<CreateResponse>("/api/rooms/create", {
        method: "POST",
        body: JSON.stringify(
          buildOnlineCreateRoomBody({
            gameType: "BUNKER",
            hostName,
            sessionId,
            visibility: "PRIVATE",
            confirmLeaveExisting,
            options: {
              winnerTarget,
              isAdult,
            },
          }),
        ),
      });
      router.push(`/room/${response.roomCode}` as Route);
    } catch (nextError) {
      const conflict = parseActiveRoomConflict(nextError);
      if (conflict) {
        setActiveRoom(conflict.activeRoom);
        setRetryIntent({
          kind: "create",
          isAdult,
          winnerTarget,
        });
        return;
      }
      setError((nextError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMatchmake(
    poolAdult: boolean,
    confirmLeaveExisting = false,
  ) {
    setSubmitting(true);
    setError(null);
    const sessionId = getOrCreateSessionId();

    try {
      const response = await apiRequest<MatchmakeResponse>(
        "/api/rooms/matchmake",
        {
          method: "POST",
          body: JSON.stringify(
            buildMatchmakeBody({
              gameType: "BUNKER",
              hostName,
              sessionId,
              isAdult: poolAdult,
              confirmLeaveExisting,
            }),
          ),
        },
      );
      router.push(`/room/${response.roomCode}` as Route);
    } catch (nextError) {
      const conflict = parseActiveRoomConflict(nextError);
      if (conflict) {
        setActiveRoom(conflict.activeRoom);
        setRetryIntent({
          kind: "matchmake",
          isAdult: poolAdult,
        });
        return;
      }
      setError((nextError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetryWithLeave() {
    if (!retryIntent) return;
    if (retryIntent.kind === "create") {
      await submitCreate(true);
    } else {
      await submitMatchmake(retryIntent.isAdult, true);
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
          {t("online_mode_tavsifi")}
        </div>

        <OnlineVisibilityTabs value={visibility} onChange={setVisibility} />

        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          {visibility === "PRIVATE"
            ? t("private_lobby_tavsifi")
            : t("public_lobby_tavsifi")}
        </p>

        {visibility === "PRIVATE" ? (
          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-4 rounded-2xl border border-line-subtle bg-bg-surface p-4"
          >
            <label className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                {t("nickname")}
              </span>
              <input
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
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
                  onClick={() => setIsAdult(true)}
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

            {error ? (
              <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !hostName.trim()}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? t("yuborilmoqda") : t("private_lobby_yaratish")}
            </button>

            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="flex h-14 w-full items-center justify-center rounded-xl border border-line-strong bg-bg-surface text-base font-semibold text-ink-primary transition active:scale-[0.98]"
            >
              {t("kod_orqali_qoshilish")}
            </button>
          </form>
        ) : (
          <div className="mt-4 grid gap-4 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            <label className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                {t("nickname")}
              </span>
              <input
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                required
                maxLength={20}
                className="h-12 w-full rounded-xl border border-line-strong bg-bg-base px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
                placeholder={t("masalan_alisher")}
              />
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={submitting || !hostName.trim()}
                onClick={() => void submitMatchmake(false)}
                className="flex h-14 w-full items-center justify-center rounded-xl bg-brand px-4 text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? t("yuborilmoqda") : t("public_normal_qoshilish")}
              </button>

              <button
                type="button"
                disabled={submitting || !hostName.trim()}
                onClick={() => void submitMatchmake(true)}
                className="flex h-14 w-full items-center justify-center rounded-xl border border-line-strong bg-bg-base px-4 text-base font-semibold text-ink-primary transition active:scale-[0.98] disabled:opacity-50"
              >
                {t("public_18_qoshilish")}
              </button>
            </div>

            {error ? (
              <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <ActiveRoomConflictModal
        activeRoom={activeRoom}
        open={!!activeRoom}
        busy={submitting}
        onContinue={() => {
          if (!activeRoom) return;
          router.push(`/room/${activeRoom.code}` as Route);
        }}
        onStartNew={() => {
          void handleRetryWithLeave();
        }}
      />

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  );
}
