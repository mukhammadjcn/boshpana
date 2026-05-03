"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";
import {
  type AuthUser,
  getAuthToken,
  setAuthToken,
  setAuthUser
} from "@/lib/auth";

type CreateResponse = {
  token: string;
  botLink: string | null;
  expiresIn: number;
};

type StatusPending = {
  status: "pending" | "needs_phone" | "rejected";
  expiresIn: number;
};

type StatusConfirmed = {
  status: "confirmed";
  token: string;
  user: AuthUser;
  redirect: string | null;
};

type StatusResponse = StatusPending | StatusConfirmed;

const POLL_MS = 2500;
const TOTAL_TTL_SECONDS = 300;

export function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "/dashboard";
  const [session, setSession] = useState<CreateResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse["status"]>("pending");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [creating, setCreating] = useState(false);
  const ranRef = useRef(false);

  // Already-authed users skip the page entirely.
  useEffect(() => {
    if (getAuthToken()) {
      router.replace(redirectTo as Route);
    }
  }, [router, redirectTo]);

  async function createSession() {
    setCreating(true);
    setError(null);
    try {
      const res = await apiRequest<CreateResponse>("/api/auth/bot-session", {
        method: "POST",
        body: JSON.stringify({ redirect: redirectTo })
      });
      setSession(res);
      setStatus("pending");
      setRemaining(res.expiresIn);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void createSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling — check status every POLL_MS until confirmed/rejected/expired.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await apiRequest<StatusResponse>(
          `/api/auth/bot-session/${session.token}`
        );
        if (cancelled) return;
        if (res.status === "confirmed") {
          setStatus("confirmed");
          setAuthToken(res.token);
          setAuthUser(res.user);
          const target = res.redirect || redirectTo || "/dashboard";
          router.replace(target as Route);
          return;
        }
        setStatus(res.status);
        setRemaining(res.expiresIn);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setSession(null);
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [session, router, redirectTo]);

  // Local countdown — ticks every second so the progress bar is smooth.
  useEffect(() => {
    if (!session) return;
    if (remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [session, remaining]);

  const expired = !!session && remaining <= 0 && status !== "confirmed";
  const showLoader = creating || (!session && !error);

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <header className="border-b border-line-subtle bg-bg-base/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-base font-bold text-bg-base">
              B
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold sm:text-base">Boshpana</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-muted sm:text-xs">
                Bunker Online
              </p>
            </div>
          </a>
          <a
            href="/"
            className="rounded-xl border border-line-strong bg-bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary"
          >
            ← Bosh sahifa
          </a>
        </div>
      </header>

      <section className="mx-auto flex max-w-md flex-col px-4 py-8 sm:py-12 lg:py-16">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand">
            Tizimga kirish
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            Telegram orqali kiring
          </h1>
          <p className="mt-2 text-sm leading-7 text-ink-secondary">
            QR kodni telefon kamerasi bilan skanerlang yoki tugmani bosing
          </p>
        </div>

        <div className="mt-7 rounded-3xl border border-line-subtle bg-bg-surface p-5 shadow-pop sm:p-6">
          {error ? (
            <div className="mb-4 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              {error}
            </div>
          ) : null}

          {showLoader ? (
            <SkeletonCard />
          ) : error ? null : expired ? (
            <ExpiredCard onRetry={() => void createSession()} />
          ) : status === "rejected" ? (
            <RejectedCard onRetry={() => void createSession()} />
          ) : session && session.botLink ? (
            <ActiveCard
              botLink={session.botLink}
              remaining={remaining}
              status={status}
            />
          ) : (
            <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
              Bot ulanmagan. Administratorga murojaat qiling.
            </div>
          )}
        </div>

        <ol className="mt-6 grid gap-2 rounded-2xl border border-line-subtle bg-bg-surface p-5 text-sm leading-6 text-ink-secondary">
          <Step n={1}>QR kodni telefon kamerasi bilan oching yoki tugmani bosing.</Step>
          <Step n={2}>Bot ko'rsatmalariga rioya qiling — kerak bo'lsa telefon raqamni ulashing.</Step>
          <Step n={3}>Avtomatik kirib turasiz — qaytib bu sahifaga kelishingiz shart emas.</Step>
        </ol>

        <DevLoginCard
          onSuccess={(payload) => {
            setAuthToken(payload.token);
            setAuthUser(payload.user);
            router.replace(redirectTo as Route);
          }}
        />
      </section>
    </main>
  );
}

// DEV-ONLY: shortcut sign-in that hits the gated /api/auth/dev-login
// endpoint. NEXT_PUBLIC_ENABLE_DEV_AUTH is inlined at build time, so when
// the prod build runs without that flag set, the early-return becomes a
// constant `null` and the impl below is dead-code-eliminated.
function DevLoginCard({
  onSuccess
}: {
  onSuccess: (payload: { token: string; user: AuthUser }) => void;
}) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH !== "1") return null;

  return <DevLoginCardImpl onSuccess={onSuccess} />;
}

function DevLoginCardImpl({
  onSuccess
}: {
  onSuccess: (payload: { token: string; user: AuthUser }) => void;
}) {
  const [nickname, setNickname] = useState("Dev");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setErr(null);
    try {
      const payload = await apiRequest<{ token: string; user: AuthUser }>(
        "/api/auth/dev-login",
        {
          method: "POST",
          body: JSON.stringify({ nickname: nickname.trim() || "Dev" })
        }
      );
      onSuccess(payload);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-dashed border-warn/40 bg-warn/5 p-4 text-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warn">
        <span className="rounded-full bg-warn/20 px-2 py-0.5">DEV</span>
        <span>Faqat ishlab chiqish muhitida</span>
      </div>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={20}
        placeholder="Test nickname"
        className="h-10 rounded-xl border border-line-strong bg-bg-base px-3 text-sm outline-none focus:border-warn"
      />
      {err ? <p className="text-xs text-bad">{err}</p> : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="flex h-11 items-center justify-center rounded-xl bg-warn/80 text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Kirilmoqda…" : "Dev login (Telegramsiz)"}
      </button>
    </div>
  );
}

function ActiveCard({
  botLink,
  remaining,
  status
}: {
  botLink: string;
  remaining: number;
  status: StatusResponse["status"];
}) {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = Math.max(0, Math.min(100, (remaining / TOTAL_TTL_SECONDS) * 100));
  const lowTime = remaining <= 60;
  const hint =
    status === "needs_phone"
      ? "Bot telefon raqamingizni so'rayapti — Telegramda ulashishni tugating."
      : "Tasdiqlash kutilmoqda — Telegramni ochiq qoldiring.";
  return (
    <div className="grid gap-5">
      {/* QR code */}
      <div className="grid place-items-center">
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-2 -top-2 h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-brand/40"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-2 -top-2 h-5 w-5 rounded-tr-lg border-r-2 border-t-2 border-brand/40"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-2 -left-2 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-brand/40"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-2 -right-2 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-brand/40"
          />
          <div className="rounded-2xl bg-white p-4 shadow-pop">
            <QRCodeSVG
              value={botLink}
              size={208}
              level="M"
              bgColor="#ffffff"
              fgColor="#0b0d12"
              marginSize={0}
            />
          </div>
        </div>
      </div>

      {/* Countdown */}
      <div className="grid gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${
              lowTime ? "bg-bad" : "bg-brand"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-ink-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
            {hint}
          </span>
          <span className="font-mono tabular-nums text-ink-secondary">
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* CTA */}
      <a
        href={botLink}
        target="_blank"
        rel="noreferrer"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
      >
        <span aria-hidden>✈</span>
        Telegram orqali kirish
      </a>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="grid gap-5">
      <div className="grid place-items-center">
        <div className="h-[240px] w-[240px] animate-pulse rounded-2xl bg-bg-elevated" />
      </div>
      <div className="h-1.5 w-full animate-pulse rounded-full bg-bg-elevated" />
      <div className="h-14 w-full animate-pulse rounded-2xl bg-bg-elevated" />
    </div>
  );
}

function ExpiredCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid gap-4 py-2 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-line-strong bg-bg-elevated text-2xl">
        ⌛
      </div>
      <p className="text-sm leading-6 text-ink-secondary">
        Sessiya muddati tugadi. Yangi havola olish uchun qaytadan urinib
        ko'ring.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-12 w-full items-center justify-center rounded-xl border border-line-strong bg-bg-elevated text-sm font-semibold"
      >
        Qayta urinish
      </button>
    </div>
  );
}

function RejectedCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid gap-4 py-2 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-bad/40 bg-bad/10 text-2xl">
        ✕
      </div>
      <p className="text-sm leading-6 text-bad">
        Telegramda kirish bekor qilindi.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-12 w-full items-center justify-center rounded-xl border border-line-strong bg-bg-elevated text-sm font-semibold"
      >
        Qayta urinish
      </button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[10px] font-semibold text-brand">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
