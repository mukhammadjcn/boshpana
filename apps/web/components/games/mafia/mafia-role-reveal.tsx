"use client";

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/lib/i18n";
import {
  getMafiaRoleMeta,
  MafiaRoleCardContent
} from "./mafia-role-card-content";
import type { MafiaPublicState } from "./mafia-types";

type Props = {
  state: MafiaPublicState;
  onConfirm: () => void;
};

const HIDE_AFTER_MS = 3000;

// O'yinchi o'zining rolini ko'radigan ekran. Tap-to-show: default'da
// rol yashirilgan (xavfsizlik — boshqa odam yelkadan qaramasin), tap
// qilsa 3 soniya ko'rinadi, keyin yana yopiladi. Hohlagancha qayta
// ochishi mumkin. Mafia o'z sheriklarining ismini ham shu vaqt
// oralig'ida ko'radi.
export function MafiaRoleReveal({ state, onConfirm }: Props) {
  const { t } = useI18n();
  const me = state.me;
  const role = me?.role ?? null;
  const meta = getMafiaRoleMeta(role);

  const [revealed, setRevealed] = useState(false);
  const hideTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    },
    [],
  );

  function handleReveal() {
    if (revealed || !role) return;
    setRevealed(true);
    hideTimer.current = window.setTimeout(() => {
      setRevealed(false);
    }, HIDE_AFTER_MS);
  }

  const confirmed = !!me?.roleConfirmed;
  const { confirmed: cCount, total: cTotal } = state.game.roleConfirmations;

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pt-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-3">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            {t("Rol tarqatildi")}
          </p>
          <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 font-mono text-xs">
            {state.room.code}
          </span>
        </header>

        <section className="mt-2 flex-1 pb-10">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            {t("Rolingizni ko'ring")}
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            {t("Tugmani bosing — rolingiz va sheriklaringiz (agar mafia bo'lsangiz) 3 soniya ko'rinadi, so'ng yana yashiriladi.")}
          </p>

          {/* Role card */}
          <button
            type="button"
            onClick={handleReveal}
            disabled={!role}
            className="relative mx-auto mt-6 flex aspect-[3/2] w-full max-w-sm overflow-hidden rounded-3xl border border-line-strong bg-bg-surface shadow-pop disabled:opacity-60 md:max-w-none"
            aria-pressed={revealed}
            style={
              revealed && meta
                ? { backgroundImage: meta.bgGradient }
                : undefined
            }
          >
            {revealed && meta && role ? (
              <MafiaRoleCardContent
                state={state}
                className="animate-fade-in"
                key="revealed"
              />
            ) : (
              <div className="flex w-full flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line-strong bg-bg-elevated text-2xl">
                  ?
                </span>
                <p className="text-base font-semibold text-ink-primary">
                  {t("Rolimni ko'rish")}
                </p>
                <p className="max-w-xs text-xs text-ink-muted">
                  {t("Tugmani bosing — qaytadan istalgancha ko'ra olasiz.")}
                </p>
              </div>
            )}
          </button>

          {/* Confirmation status */}
          <div className="mt-6 rounded-2xl border border-line-subtle bg-bg-surface p-4">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold">{t("Tasdiqlanganlar")}</p>
              <p className="font-mono text-brand">
                {cCount} / {cTotal}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full bg-brand transition-all"
                style={{
                  width: `${cTotal > 0 ? Math.round((cCount / cTotal) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              {t("Hamma rolini tasdiqlagach, host birinchi tunni boshlaydi.")}
            </p>
          </div>
        </section>

        {/* Bottom action bar */}
        <div className="sticky bottom-0 grid gap-2 bg-bg-base/95 pb-safe pt-3 backdrop-blur">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmed || !role}
            className={`flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
              confirmed
                ? "bg-bg-elevated text-ink-muted"
                : "bg-brand text-bg-base"
            }`}
          >
            {confirmed ? t("✓ Tasdiqlandi — kuting") : t("Tasdiqlash")}
          </button>
        </div>
      </div>
    </main>
  );
}
