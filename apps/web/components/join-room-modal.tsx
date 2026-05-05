"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getOrCreateSessionId } from "@/lib/storage";

type JoinRoomModalProps = {
  open: boolean;
  onClose: () => void;
  defaultCode?: string;
};

export function JoinRoomModal({
  open,
  onClose,
  defaultCode = ""
}: JoinRoomModalProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState(defaultCode);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setJoinCode(defaultCode.toUpperCase());
      setError(null);
      const cached = getAuthUser();
      const fallback =
        cached?.nickname ??
        cached?.firstName ??
        cached?.telegramUsername ??
        "";
      if (fallback) {
        setJoinName((current) => current || fallback);
      }
    }
  }, [defaultCode, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoinLoading(true);
    setError(null);

    try {
      const sessionId = getOrCreateSessionId();
      const roomCode = joinCode.toUpperCase();

      await apiRequest(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        body: JSON.stringify({
          name: joinName,
          sessionId
        })
      });

      onClose();
      router.push(`/room/${roomCode}`);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setJoinLoading(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg-overlay backdrop-blur-sm sm:items-center"
    >
      <div className="absolute inset-0" />
      <form
        onSubmit={handleJoin}
        className="relative z-10 w-full max-w-md rounded-t-3xl border-t border-line-subtle bg-bg-surface p-5 pb-safe shadow-pop sm:rounded-3xl sm:border"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("roomga_qoshilish")}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{t("kod_va_nickname")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("yopish")}
            className="-mr-1 grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-bg-elevated text-ink-secondary"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <input
            value={joinCode}
            onChange={(event) =>
              setJoinCode(event.target.value.toUpperCase().slice(0, 8))
            }
            required
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-14 rounded-2xl border border-line-strong bg-bg-base px-4 font-mono text-base uppercase tracking-[0.3em] text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
            placeholder="ROOM CODE"
          />
          <input
            value={joinName}
            onChange={(event) => setJoinName(event.target.value)}
            required
            maxLength={20}
            className="h-14 rounded-2xl border border-line-strong bg-bg-base px-4 text-base text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring"
            placeholder={t("nickname")}
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}

        <button
          disabled={joinLoading || !joinCode.trim() || !joinName.trim()}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
        >
          {joinLoading ? t("kirilmoqda") : t("roomga_kirish")}
        </button>
      </form>
    </div>
  );
}
