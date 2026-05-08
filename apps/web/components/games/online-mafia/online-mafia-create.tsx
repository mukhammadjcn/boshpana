"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
import { JoinRoomModal } from "@/components/join-room-modal";

type CreateResponse = {
  roomCode: string;
};

type MatchmakeResponse = {
  roomCode: string;
  isNew: boolean;
};

type RetryIntent =
  | {
      kind: "create";
      mafiaCount: number;
      hasSheriff: boolean;
      hasDoctor: boolean;
    }
  | { kind: "matchmake" }
  | null;

const rules = [
  "mafia_qoida_1",
  "mafia_qoida_2",
  "mafia_qoida_3",
  "mafia_qoida_4",
];

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 15;

export function OnlineMafiaCreate() {
  const router = useRouter();
  const { t } = useI18n();
  const [visibility, setVisibility] = useState<OnlineVisibilityTab>("PUBLIC");
  const [hostName, setHostName] = useState("");
  const [mafiaCount, setMafiaCount] = useState(1);
  const [hasSheriff, setHasSheriff] = useState(true);
  const [hasDoctor, setHasDoctor] = useState(true);
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

  const maxMafiaForSize = Math.max(
    1,
    Math.min(3, MAX_PLAYERS - (hasSheriff ? 1 : 0) - (hasDoctor ? 1 : 0) - 1),
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
      const response = await apiRequest<MatchmakeResponse>(
        "/api/rooms/matchmake",
        {
          method: "POST",
          body: JSON.stringify(
            buildMatchmakeBody({
              gameType: "MAFIA",
              hostName,
              sessionId,
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
      <section className="mt-2 flex-1 pb-10 lg:mt-6">
        {/* Game banner — shares artwork with the dashboard card so
                    the detail page reads as a continuation of the same
                    entry. Landscape ratio gives desktop visual weight. */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-line-subtle bg-bg-surface">
          <Image
            src="/mafia/banner.webp"
            alt={t("mafia_banner")}
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-bg-base/10 to-transparent" />
        </div>

        <h1 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
          {t("mafia_kim_xiyonatkor")}
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {t("min_max_oyinchi_30_45_e4e4", {
            min: MIN_PLAYERS,
            max: MAX_PLAYERS,
          })}
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
                  <span className="text-sm font-semibold">
                    {t("komisar_2")}
                  </span>
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

            <div className="rounded-xl border border-line-strong bg-bg-base px-3 py-2.5 text-xs text-ink-muted">
              {t("tarkib")}:{" "}
              <span className="font-semibold text-ink-primary">
                {citizenCount}
              </span>{" "}
              {t("fuqaro")} ·{" "}
              <span className="font-semibold text-ink-primary">
                {mafiaCount}
              </span>{" "}
              {t("mafia")}
              {hasSheriff && <> · 1 {t("komisar")}</>}
              {hasDoctor && <> · 1 {t("doktor")}</>}
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

            <button
              type="button"
              disabled={submitting || !hostName.trim()}
              onClick={() => void submitMatchmake(false)}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? t("yuborilmoqda") : "Ommaviy lobbiga qo'shilish"}
            </button>

            {error ? (
              <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />

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
