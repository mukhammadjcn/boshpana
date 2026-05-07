"use client";

import Image from "next/image";

import { useI18n } from "@/lib/i18n";
import { GameModalShell } from "../shared/game-modal-shell";
import { getMafiaRoleMeta, MafiaRoleCardContent } from "./mafia-role-card-content";
import type { MafiaPublicState } from "./mafia-types";

export function MafiaSelfEliminationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <GameModalShell
      align="sheet"
      zIndexClassName="z-50"
      overlayClassName="bg-bg-overlay backdrop-blur-md"
      panelClassName="w-full max-w-md overflow-hidden rounded-t-3xl border-t border-bad/40 bg-bg-surface pb-safe shadow-pop sm:rounded-3xl sm:border"
      panelStyle={{
        backgroundImage:
          "radial-gradient(circle at 50% 0%, rgba(239,68,68,0.22), transparent 55%), linear-gradient(180deg, rgba(239,68,68,0.04) 0%, rgba(11,13,18,0) 60%)",
      }}
    >
      <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

      <div className="px-6 pt-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-bad/30 bg-bad/10">
          <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-bad"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-bad">
          {t("eliminatsiya")}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-ink-primary">
          {t("siz_oyindan_chiqdingiz")}
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink-secondary">
          {t("siz_endi_bu_raundda_qatnasha_df26")}
        </p>
      </div>

      <div className="px-5 pt-5 pb-5">
        <button
          type="button"
          onClick={onClose}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-bad text-base font-semibold text-white transition active:scale-[0.98]"
        >
          {t("kuzatishda_davom_etish")}
        </button>
      </div>
    </GameModalShell>
  );
}

export function MafiaRoleReminderModal({
  visible,
  open,
  state,
  onClose,
}: {
  visible: boolean;
  open: boolean;
  state: MafiaPublicState;
  onClose: () => void;
}) {
  const meta = getMafiaRoleMeta(state.me?.role ?? null);
  if (!visible || !state.me?.role || !meta) return null;

  return (
    <GameModalShell
      align="sheet"
      zIndexClassName="z-50"
      overlayClassName={`bg-bg-overlay/90 backdrop-blur-md transition duration-200 ${
        open ? "opacity-100" : "opacity-0"
      }`}
      panelClassName={`w-full max-w-xl px-5 transition duration-200 sm:px-0 ${
        open
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-3 scale-[0.98] opacity-0"
      }`}
      onBackdropClick={onClose}
    >
      <div
        className="overflow-hidden rounded-3xl border border-line-strong bg-bg-surface shadow-pop"
        style={{ backgroundImage: meta.bgGradient }}
      >
        <MafiaRoleCardContent state={state} className="py-10" />
      </div>
    </GameModalShell>
  );
}

export function MafiaPhaseIntroModal({
  phaseIntro,
  meIsTiebreakCandidate,
  allAliveAreTied,
  onClose,
}: {
  phaseIntro: { kind: "night" | "day" | "tiebreak"; key: string } | null;
  meIsTiebreakCandidate: boolean;
  allAliveAreTied: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  if (!phaseIntro) return null;

  const phaseIntroArt =
    phaseIntro.kind === "night"
      ? "/mafia/night-banner.webp"
      : phaseIntro.kind === "day"
        ? "/mafia/day-banner.webp"
        : null;

  return (
    <GameModalShell
      zIndexClassName="z-[60]"
      overlayClassName="bg-bg-overlay/90 px-5 backdrop-blur-md"
      backdropClassName="bg-[radial-gradient(circle_at_top,rgba(247,181,79,0.16),transparent_40%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.06),transparent_35%)]"
      panelClassName="w-full max-w-md overflow-hidden rounded-3xl border border-line-strong bg-bg-surface text-center shadow-pop"
    >
      {phaseIntroArt ? (
        <div className="relative">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={phaseIntroArt}
              alt={
                phaseIntro.kind === "night"
                  ? t("tun_boshlanmoqda")
                  : phaseIntro.kind === "tiebreak"
                    ? t("qayta_ovoz_boshlanmoqda")
                    : t("kun_boshlanmoqda")
              }
              fill
              sizes="(max-width: 640px) 90vw, 420px"
              className="object-cover"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-surface/85 via-transparent to-transparent" />
        </div>
      ) : null}
      <div className="px-6 pb-7 pt-5">
        {phaseIntro.kind === "tiebreak" ? (
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-brand/35 bg-brand/12 text-brand">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3v18" />
              <path d="M7 8h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" />
            </svg>
          </div>
        ) : null}
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-brand">
          {phaseIntro.kind === "night"
            ? t("tun_boshlanmoqda")
            : phaseIntro.kind === "tiebreak"
              ? t("qayta_ovoz_boshlanmoqda")
              : t("kun_boshlanmoqda")}
        </p>
        <p className="mt-3 text-sm leading-7 text-ink-secondary">
          {phaseIntro.kind === "night"
            ? t("tun_yaqin_tavsifi")
            : phaseIntro.kind === "tiebreak"
              ? meIsTiebreakCandidate && !allAliveAreTied
                ? t("siz_qayta_ovoz_nomzodisiz")
                : t("ovozlar_teng_boldi_qayta_ovoz_bering")
              : t("kun_yorishdi_tavsifi")}
        </p>
        <p className="mt-5 text-xs text-ink-muted">
          {t("jarayon_seconds_soniyadan_keyin_davom_etadi", {
            seconds: phaseIntro.kind === "tiebreak" ? 6 : 9,
          })}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
        >
          {t("tushundim")}
        </button>
      </div>
    </GameModalShell>
  );
}
