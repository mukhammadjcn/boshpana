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
  | { kind: "create"; mafiaCount: number; hasSheriff: boolean; hasDoctor: boolean }
  | { kind: "matchmake" }
  | null;

const MAX_PLAYERS = 15;

export function OnlineMafiaCreate() {
  const router = useRouter();
  const { t } = useI18n();
  const [visibility, setVisibility] =
    useState<OnlineVisibilityTab>("PRIVATE");
  const [hostName, setHostName] = useState("");
  const [mafiaCount, setMafiaCount] = useState(2);
  const [hasSheriff, setHasSheriff] = useState(true);
  const [hasDoctor, setHasDoctor] = useState(true);
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

  const maxMafiaForSize = Math.max(
    1,
    Math.min(
      3,
      MAX_PLAYERS - (hasSheriff ? 1 : 0) - (hasDoctor ? 1 : 0) - 1,
    ),
  );

  useEffect(() => {
    setMafiaCount((current) => Math.min(current, maxMafiaForSize));
  }, [maxMafiaForSize]);

  async function submitCreate(confirmLeaveExisting = false) {
    setSubmitting(true);
    setError(null);
    const sessionId = getOrCreateSessionId();

    try {
      const response = await apiRequest<CreateResponse>("/api/rooms/create", {
        method: "POST",
        body: JSON.stringify(
          buildOnlineCreateRoomBody({
            gameType: "MAFIA",
            hostName,
            sessionId,
            visibility: "PRIVATE",
            confirmLeaveExisting,
            options: {
              mafiaCount,
              hasSheriff,
              hasDoctor,
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
          mafiaCount,
          hasSheriff,
          hasDoctor,
        });
        return;
      }
      setError((nextError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMatchmake(confirmLeaveExisting = false) {
    setSubmitting(true);
    setError(null);
    const sessionId = getOrCreateSessionId();

    try {
      const response = await apiRequest<MatchmakeResponse>("/api/rooms/matchmake", {
        method: "POST",
        body: JSON.stringify(
          buildMatchmakeBody({
            gameType: "MAFIA",
            hostName,
            sessionId,
            confirmLeaveExisting,
          }),
        ),
      });
      router.push(`/room/${response.roomCode}` as Route);
    } catch (nextError) {
      const conflict = parseActiveRoomConflict(nextError);
      if (conflict) {
        setActiveRoom(conflict.activeRoom);
        setRetryIntent({ kind: "matchmake" });
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
      await submitMatchmake(true);
    }
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCreate(false);
  }

  const citizenCount = Math.max(
    0,
    MAX_PLAYERS - mafiaCount - (hasSheriff ? 1 : 0) - (hasDoctor ? 1 : 0),
  );

  return (
    <>
      <section className="mt-4 flex-1 pb-10">
        <div className="rounded-3xl border border-line-subtle bg-bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            {t("tab_online")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-ink-primary">
            {t("online_mafia_sarlavha")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {t("online_mafia_tavsif")}
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                  {t("mafia_soni")}
                </span>
                <span className="font-mono text-sm text-brand">
                  {mafiaCount}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={maxMafiaForSize}
                step={1}
                value={mafiaCount}
                onChange={(event) => setMafiaCount(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-brand"
              />
            </div>

            <div className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                {t("maxsus_rollar")}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHasSheriff((current) => !current)}
                  aria-pressed={hasSheriff}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                    hasSheriff
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line-strong bg-bg-base text-ink-secondary"
                  }`}
                >
                  <span className="text-sm font-semibold">{t("komisar_2")}</span>
                  <span className="text-[11px] text-ink-muted">
                    {hasSheriff ? t("yoqilgan") : t("ochirilgan")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setHasDoctor((current) => !current)}
                  aria-pressed={hasDoctor}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center transition active:scale-[0.98] ${
                    hasDoctor
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line-strong bg-bg-base text-ink-secondary"
                  }`}
                >
                  <span className="text-sm font-semibold">{t("doktor_2")}</span>
                  <span className="text-[11px] text-ink-muted">
                    {hasDoctor ? t("yoqilgan") : t("ochirilgan")}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line-subtle bg-bg-base p-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-muted">
                  {t("mafia_2")}
                </p>
                <p className="mt-1 font-semibold text-ink-primary">
                  {mafiaCount}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-muted">
                  {t("aholi")}
                </p>
                <p className="mt-1 font-semibold text-ink-primary">
                  {citizenCount}
                </p>
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
              {submitting ? t("yuborilmoqda") : t("public_qoshilish")}
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
