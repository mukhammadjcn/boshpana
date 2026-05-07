"use client";

import type { FormEvent } from "react";

import { TelegramChrome } from "@/components/telegram-chrome";
import { useI18n } from "@/lib/i18n";

type RoomCodeCardProps = {
  roomCode: string;
  prefixHash?: boolean;
  trackingClassName?: string;
};

function RoomCodeCard({
  roomCode,
  prefixHash = false,
  trackingClassName = "tracking-[0.3em]",
}: RoomCodeCardProps) {
  const { t } = useI18n();

  return (
    <div className="mt-5 rounded-2xl border border-line-subtle bg-bg-surface p-4">
      <p className="text-xs text-ink-muted">{t("room_code")}</p>
      <p
        className={`mt-1 font-mono text-2xl font-semibold uppercase ${trackingClassName}`}
      >
        {prefixHash ? `#${roomCode}` : roomCode}
      </p>
    </div>
  );
}

type SharedFrameProps = {
  children: React.ReactNode;
  backHref?: string;
};

function EntryFrame({ children, backHref }: SharedFrameProps) {
  return (
    <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
      {backHref ? <TelegramChrome backHref={backHref} /> : null}
      <div className="mx-auto max-w-md pt-6">{children}</div>
    </main>
  );
}

type KickedStateProps = {
  onGoHome: () => void;
};

export function KickedFromRoomState({ onGoHome }: KickedStateProps) {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-bg-base px-5 pt-safe pb-safe text-ink-primary">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay px-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-md rounded-3xl border border-bad/40 bg-bg-surface p-6 text-center shadow-pop">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-bad/40 bg-bad/10 text-2xl text-bad">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </div>
          <h3 className="mt-4 text-xl font-bold text-ink-primary">
            {t("sizni_oyindan_chiqarishdi")}
          </h3>
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {t("host_sizni_oyindan_chiqarib_yubordi_f51a")}
          </p>
          <button
            type="button"
            onClick={onGoHome}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
          >
            {t("bosh_sahifa")}
          </button>
        </div>
      </div>
    </main>
  );
}

type UnavailableRoomStateProps = {
  roomCode: string;
  finished: boolean;
  startedDescriptionKey: string;
  onGoHome: () => void;
  backHref?: string;
  prefixHash?: boolean;
  trackingClassName?: string;
};

export function UnavailableRoomState({
  roomCode,
  finished,
  startedDescriptionKey,
  onGoHome,
  backHref,
  prefixHash,
  trackingClassName,
}: UnavailableRoomStateProps) {
  const { t } = useI18n();

  return (
    <EntryFrame backHref={backHref}>
      <p
        className={`text-xs font-medium uppercase tracking-wider ${
          finished ? "text-bad" : "text-warn"
        }`}
      >
        {finished ? t("yopiq") : t("boshlangan")}
      </p>
      <h1 className="mt-1 text-2xl font-bold">
        {finished
          ? t("bu_oyin_yakunlangan")
          : t("bu_oyin_allaqachon_boshlangan")}
      </h1>
      <p className="mt-3 text-sm leading-7 text-ink-secondary">
        {finished
          ? t("yangi_oyin_yarating_yoki_ochiq_e3ed")
          : t(startedDescriptionKey)}
      </p>
      <RoomCodeCard
        roomCode={roomCode}
        prefixHash={prefixHash}
        trackingClassName={trackingClassName}
      />
      <button
        type="button"
        onClick={onGoHome}
        className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
      >
        {t("bosh_sahifa")}
      </button>
    </EntryFrame>
  );
}

type LoginPromptStateProps = {
  roomCode: string;
  pretitleKey: string;
  loginHref: string;
  backHref?: string;
  prefixHash?: boolean;
  trackingClassName?: string;
};

export function LoginPromptRoomState({
  roomCode,
  pretitleKey,
  loginHref,
  backHref,
  prefixHash,
  trackingClassName,
}: LoginPromptStateProps) {
  const { t } = useI18n();

  return (
    <EntryFrame backHref={backHref}>
      <p className="text-xs font-medium uppercase tracking-wider text-brand">
        {t(pretitleKey)}
      </p>
      <h1 className="mt-1 text-2xl font-bold">
        {t("roomga_kirish_uchun_tizimga_kiring")}
      </h1>
      <p className="mt-3 text-sm leading-7 text-ink-secondary">
        {t("roomga_qoshilish_uchun_bot_orqali_123f")}
      </p>
      <RoomCodeCard
        roomCode={roomCode}
        prefixHash={prefixHash}
        trackingClassName={trackingClassName}
      />
      <a
        href={loginHref}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
      >
        <span aria-hidden>✈</span>
        {t("telegramda_kirish")}
      </a>
    </EntryFrame>
  );
}

type JoinWithNicknameStateProps = {
  roomCode: string;
  pretitleKey: string;
  joinName: string;
  error: string | null;
  onJoinNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  backHref?: string;
  prefixHash?: boolean;
  trackingClassName?: string;
};

export function JoinWithNicknameRoomState({
  roomCode,
  pretitleKey,
  joinName,
  error,
  onJoinNameChange,
  onSubmit,
  backHref,
  prefixHash,
  trackingClassName,
}: JoinWithNicknameStateProps) {
  const { t } = useI18n();

  return (
    <EntryFrame backHref={backHref}>
      <p className="text-xs font-medium uppercase tracking-wider text-brand">
        {t(pretitleKey)}
      </p>
      <h1 className="mt-1 text-2xl font-bold">
        {t("roomga_kirish_uchun_nickname_yozing")}
      </h1>
      <RoomCodeCard
        roomCode={roomCode}
        prefixHash={prefixHash}
        trackingClassName={trackingClassName}
      />
      <form onSubmit={onSubmit} className="mt-5 grid gap-3">
        <input
          value={joinName}
          onChange={(event) => onJoinNameChange(event.target.value)}
          required
          maxLength={20}
          className="h-14 rounded-2xl border border-line-strong bg-bg-surface px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
          placeholder={t("nickname")}
        />
        <button className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]">
          {t("roomga_kirish")}
        </button>
      </form>
      {error ? (
        <p className="mt-3 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
    </EntryFrame>
  );
}
