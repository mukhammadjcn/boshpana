"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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

export function OnlineBunkerCreate() {
  const router = useRouter();
  const { t } = useI18n();
  const [visibility, setVisibility] =
    useState<OnlineVisibilityTab>("PRIVATE");
  const [hostName, setHostName] = useState("");
  const [winnerTarget, setWinnerTarget] = useState(2);
  const [isAdult, setIsAdult] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<ActiveRoomSummary | null>(null);
  const [retryIntent, setRetryIntent] = useState<RetryIntent>(null);

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

  async function submitMatchmake(poolAdult: boolean, confirmLeaveExisting = false) {
    setSubmitting(true);
    setError(null);
    const sessionId = getOrCreateSessionId();

    try {
      const response = await apiRequest<MatchmakeResponse>("/api/rooms/matchmake", {
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
      });
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
      <section className="mt-4 flex-1 pb-10">
        <div className="rounded-3xl border border-line-subtle bg-bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            {t("tab_online")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-ink-primary">
            {t("online_bunker_sarlavha")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {t("online_bunker_tavsif")}
          </p>
        </div>

        <OnlineVisibilityTabs value={visibility} onChange={setVisibility} />

        {visibility === "PRIVATE" ? (
          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-4 rounded-2xl border border-line-subtle bg-bg-surface p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t("private_lobby_tavsifi")}
            </p>

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
                    {t("faqat_kattalar_uchun_tavsif")}
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
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? t("yuborilmoqda") : t("private_lobby_yaratish")}
            </button>
          </form>
        ) : (
          <div className="mt-4 grid gap-4 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t("public_lobby_tavsifi")}
            </p>

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

            <button
              type="button"
              disabled={submitting || !hostName.trim()}
              onClick={() => void submitMatchmake(false)}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? t("yuborilmoqda") : t("public_normal_qoshilish")}
            </button>

            <button
              type="button"
              disabled={submitting || !hostName.trim()}
              onClick={() => void submitMatchmake(true)}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-base text-base font-semibold text-ink-primary transition active:scale-[0.98] disabled:opacity-50"
            >
              {t("public_18_qoshilish")}
            </button>

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
    </>
  );
}
