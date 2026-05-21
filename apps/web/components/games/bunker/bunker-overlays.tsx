"use client";

import Image from "next/image";
import type { CSSProperties } from "react";

import { useI18n } from "@/lib/i18n";
import { Timer } from "@/components/timer";
import {
  GameBottomSheetShell,
  GameModalShell,
} from "../shared/game-modal-shell";
import type { BunkerActionCardView } from "./bunker-types";

type MyCardsSheetProps = {
  open: boolean;
  closing: boolean;
  revealedCount: number;
  cards: Array<{
    type: string;
    label: string;
    value: string;
    isRevealed: boolean;
  }>;
  actionCards?: BunkerActionCardView[];
  // EXTRA_BAGGAGE action card orqali olingan qo'shimcha bagaj matnlari.
  // Asosiy bagaj kartasidan keyin alohida BAGAJ qatorlar sifatida ko'rinadi.
  extraBaggage?: string[];
  canPlayActionCards?: boolean;
  onPlayActionCard?: (instanceId: string) => void;
  onClose: () => void;
};

// Tier ranglari — har darajaga sezilmaydigan tint, lekin alohida belgilanib turadi.
const ACTION_TIER_TINT: Record<number, string> = {
  1: "border-line-subtle bg-bg-base",
  2: "border-amber-500/50 bg-amber-500/5",
  3: "border-rose-500/50 bg-rose-500/5",
};

const ACTION_TIER_BADGE: Record<number, string> = {
  1: "bg-bg-elevated text-ink-muted",
  2: "bg-amber-500/20 text-amber-400",
  3: "bg-rose-500/20 text-rose-400",
};

const TIER_LABEL_KEY: Record<number, string> = {
  1: "tier_oddiy",
  2: "tier_ortacha",
  3: "tier_kuchli",
};

export function BunkerMyCardsSheet({
  open,
  closing,
  revealedCount,
  cards,
  actionCards,
  extraBaggage,
  canPlayActionCards = false,
  onPlayActionCard,
  onClose,
}: MyCardsSheetProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <GameModalShell
      align="sheet"
      zIndexClassName="z-50"
      overlayClassName={`bg-bg-overlay backdrop-blur-sm ${
        closing ? "animate-overlay-out" : "animate-overlay-in"
      }`}
      panelClassName={`w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-line-subtle bg-bg-surface px-5 pt-4 pb-safe ${
          closing ? "animate-sheet-out" : "animate-sheet-in"
        }`}
      onBackdropClick={onClose}
    >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("mening_kartalarim")}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">
              {t("count_6_ochilgan", { count: revealedCount })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-bg-elevated"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {cards.map((card) => (
            <div
              key={card.type}
              className={`rounded-2xl border p-3 ${
                card.isRevealed
                  ? "border-brand/30 bg-brand-soft"
                  : "border-line-subtle bg-bg-base"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  {card.label}
                </p>
                {card.isRevealed ? (
                  <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    {t("ochiq")}
                  </span>
                ) : (
                  <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                    {t("yashirin")}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-ink-primary">{card.value}</p>
            </div>
          ))}

          {/* "Yashirin ombor" action card orqali olingan qo'shimcha bagajlar.
              O'yinchining o'zi ishlatgani uchun avtomatik ochiq holatda. */}
          {(extraBaggage ?? []).map((text, idx) => (
            <div
              key={`extra-baggage-${idx}`}
              className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  {t("BAGGAGE") ?? "Bagaj"} +
                </p>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  {t("qoshimcha") ?? "Qo'shimcha"}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-ink-primary">{text}</p>
            </div>
          ))}

          {(actionCards ?? []).map((ac) => {
            const isPlayed = ac.status !== "HELD";
            const tint = ACTION_TIER_TINT[ac.tier] ?? ACTION_TIER_TINT[1];
            const badge = ACTION_TIER_BADGE[ac.tier] ?? ACTION_TIER_BADGE[1];
            const tierLabel = t(TIER_LABEL_KEY[ac.tier] ?? "tier_oddiy");
            const title = ac.title.uz; // pickText keyingi commit'da bo'ladi
            const description = ac.description.uz;
            return (
              <div
                key={ac.instanceId}
                className={`rounded-2xl border p-3 ${tint} ${
                  isPlayed ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    {t("maxsus_kartalar")}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}
                  >
                    {tierLabel}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-ink-primary">
                  {title}
                </p>
                <p className="mt-0.5 text-xs text-ink-secondary leading-snug">
                  {description}
                </p>
                {!isPlayed && canPlayActionCards && onPlayActionCard ? (
                  <button
                    type="button"
                    onClick={() => onPlayActionCard(ac.instanceId)}
                    className="mt-2 w-full rounded-lg bg-brand px-2 py-1.5 text-xs font-semibold text-bg-base transition active:scale-[0.98]"
                  >
                    {t("ishlatish")}
                  </button>
                ) : isPlayed ? (
                  <p className="mt-1.5 text-[11px] text-ink-muted">
                    {t("ishlatilgan")}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
    </GameModalShell>
  );
}

type DisasterIntroModalProps = {
  open: boolean;
  imageSrc?: string;
  title: string;
  description: string;
  onClose: () => void;
};

export function BunkerDisasterIntroModal({
  open,
  imageSrc,
  title,
  description,
  onClose,
}: DisasterIntroModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <GameBottomSheetShell
      zIndexClassName="z-40"
      animated={false}
      overlayClassName="bg-bg-overlay backdrop-blur-sm"
      panelClassName="overflow-hidden pb-safe"
      showHandle={false}
    >
        <div className="mx-auto mt-3 mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        {imageSrc ? (
          <div className="relative aspect-[16/10] w-full overflow-hidden">
            <Image
              src={imageSrc}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, 448px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-surface via-bg-surface/40 to-transparent" />
          </div>
        ) : null}
        <div className="px-5 pb-5 pt-1">
          <p className="text-xs font-medium uppercase tracking-wider text-brand">
            {t("fojea")}
          </p>
          <h2 className="mt-1 text-2xl font-bold">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {description}
          </p>
          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("tushundim")}
            </button>
          </div>
        </div>
    </GameBottomSheetShell>
  );
}

type SituationModalProps = {
  open: boolean;
  closing: boolean;
  roundNumber: number;
  text: string;
  voteReason?: string | null;
  onClose: () => void;
};

export function BunkerSituationModal({
  open,
  closing,
  roundNumber,
  text,
  voteReason,
  onClose,
}: SituationModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <GameBottomSheetShell
      closing={closing}
      zIndexClassName="z-40"
      panelClassName="p-5 pb-safe"
    >
        <p className="text-xs font-medium uppercase tracking-wider text-warn">
          {t("round_roundnumber_vaziyati", { roundNumber })}
        </p>
        <p className="mt-3 text-base leading-7 text-ink-primary">{text}</p>
        {voteReason ? (
          <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm leading-6 text-warn">
            {voteReason}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
        >
          {t("roundga_kirish")}
        </button>
    </GameBottomSheetShell>
  );
}

type EliminationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function BunkerEliminationModal({
  open,
  onClose,
}: EliminationModalProps) {
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
            {t("siz_bunkerdan_chiqarildingiz")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {t("sizning_kartalaringiz_endi_hammaga_ochiq_44da")}
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

type WinnerModalProps = {
  open: boolean;
  isAlive: boolean;
  winnerNames: string[];
  onClose: () => void;
  onGoHome: () => void;
};

export function BunkerWinnerModal({
  open,
  isAlive,
  winnerNames,
  onClose,
  onGoHome,
}: WinnerModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <GameModalShell
      align="sheet"
      zIndexClassName="z-50"
      overlayClassName="bg-bg-overlay backdrop-blur-md"
      panelClassName="w-full max-w-md overflow-hidden rounded-t-3xl border-t border-brand/40 bg-bg-surface pb-safe shadow-pop sm:rounded-3xl sm:border"
      panelStyle={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(244,168,58,0.28), transparent 55%), linear-gradient(180deg, rgba(34,197,94,0.06) 0%, rgba(11,13,18,0) 70%)",
        }}
    >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

        <div className="px-6 pt-6 text-center">
          <div
            className={`mx-auto grid h-20 w-20 place-items-center rounded-full border ${
              isAlive ? "border-brand/40 bg-brand/15" : "border-bad/40 bg-bad/15"
            }`}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isAlive ? "text-brand" : "text-bad"}
              aria-hidden
            >
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
              <path d="M17 4h3v3a3 3 0 0 1-3 3" />
              <path d="M7 4H4v3a3 3 0 0 0 3 3" />
            </svg>
          </div>
          <p
            className={`mt-4 text-xs font-medium uppercase tracking-[0.25em] ${
              isAlive ? "text-brand" : "text-bad"
            }`}
          >
            {isAlive ? t("galaba") : t("oyin_tugadi")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-ink-primary">
            {isAlive
              ? t("siz_bunkerda_omon_qoldingiz")
              : t("bu_safar_omad_yor_bolmadi")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink-secondary">
            {isAlive
              ? t("tabriklaymiz_insoniyatning_kelajagini_siz_tiklaysiz")
              : t("siz_oyindan_chiqib_ketgansiz_lekin_f036")}
            {winnerNames.length > 0
              ? ` ${t("bunkerda_qolganlar")} ${winnerNames.join(", ")}.`
              : ` ${t("bunkerda_hech_kim_qolmadi")}`}
          </p>
        </div>

        <div className="grid gap-2 px-5 pt-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98]"
          >
            {t("natijani_korish")}
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-elevated text-sm font-semibold text-ink-primary"
          >
            {t("bosh_sahifa")}
          </button>
        </div>
    </GameModalShell>
  );
}

type RevealChoiceModalProps = {
  open: boolean;
  seconds: number;
  options: Array<{
    type: string;
    label: string;
    value: string;
  }>;
  onReveal: (cardType: string) => void;
};

export function BunkerRevealChoiceModal({
  open,
  seconds,
  options,
  onReveal,
}: RevealChoiceModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <GameBottomSheetShell
      zIndexClassName="z-40"
      animated={false}
      overlayClassName="bg-bg-overlay backdrop-blur-sm"
      panelClassName="max-h-[85vh] overflow-y-auto px-5 pt-4 pb-safe"
    >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("sizning_navbatingiz")}
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {t("bitta_kartani_tanlang")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              {t("tanlaganingizdan_keyin_2_daqiqada_nega_18e0")}
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <Timer seconds={seconds} variant="warning" />
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {options.map((card) => (
            <button
              key={card.type}
              type="button"
              onClick={() => onReveal(card.type)}
              className="rounded-2xl border border-line-subtle bg-bg-base p-4 text-left transition active:scale-[0.99]"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                {card.label}
              </p>
              <p className="mt-1 text-base text-ink-primary">{card.value}</p>
            </button>
          ))}
        </div>
    </GameBottomSheetShell>
  );
}

type CardReplaceModalProps = {
  open: boolean;
  animationKey: string;
  // Kim almashtirdi (manba).
  actorName: string;
  // Kimning kartasi almashtirildi (manba == nishon bo'lsa, "o'zining" varianti chiqadi).
  targetName: string;
  isSelf: boolean;
  cardLabel: string;
  fromValue: string;
  toValue: string;
  onClose: () => void;
};

export function BunkerCardReplaceModal({
  open,
  animationKey,
  actorName,
  targetName,
  isSelf,
  cardLabel,
  fromValue,
  toValue,
  onClose,
}: CardReplaceModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  // "Asror Hikmatillo'ning Sog'liq kartasini almashtirdi"
  // "Asror o'zining Sog'liq kartasini almashtirdi"
  const headline = isSelf
    ? t("name_ozining_label_kartasini_almashtirdi", {
        name: actorName,
        label: cardLabel,
      }) ?? `${actorName} o'zining ${cardLabel} kartasini almashtirdi`
    : t("name_targetning_label_kartasini_almashtirdi", {
        name: actorName,
        target: targetName,
        label: cardLabel,
      }) ??
      `${actorName} ${targetName}ning ${cardLabel} kartasini almashtirdi`;

  return (
    <GameModalShell
      zIndexClassName="z-50"
      overlayClassName="bg-bg-overlay px-4 backdrop-blur-md"
      panelClassName="w-full max-w-md rounded-3xl border border-line-strong bg-bg-surface p-5 shadow-pop"
      stopPanelClick
    >
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-amber-400">
        {t("karta_almashtirildi") ?? "Karta almashtirildi"}
      </p>
      <h3 className="mt-1 text-base font-semibold leading-snug text-ink-primary">
        {headline}
      </h3>

      <div
        className="mt-5 grid gap-3"
        key={animationKey}
        style={{ perspective: 1200 }}
      >
        <div className="rounded-2xl border border-bad/30 bg-bad/5 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-bad">
            {t("eski") ?? "Eski"} · {cardLabel}
          </p>
          <p className="mt-1.5 text-base leading-7 text-ink-secondary line-through decoration-bad/60">
            {fromValue}
          </p>
        </div>

        <div className="flex items-center justify-center text-ink-muted">
          <span aria-hidden className="text-xl">↓</span>
        </div>

        <div className="animate-card-flip rounded-2xl border border-ok/40 bg-ok/10 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ok">
            {t("yangi") ?? "Yangi"} · {cardLabel}
          </p>
          <p className="mt-1.5 text-base font-semibold leading-7 text-ink-primary">
            {toValue}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
      >
        {t("tushundim")}
      </button>
    </GameModalShell>
  );
}

type CardRevealModalProps = {
  open: boolean;
  animationKey: string;
  playerName: string;
  cardLabel: string;
  newCardValue: string;
  olderCards: Array<{ type: string; label: string; value: string }>;
  onClose: () => void;
};

export function BunkerCardRevealModal({
  open,
  animationKey,
  playerName,
  cardLabel,
  newCardValue,
  olderCards,
  onClose,
}: CardRevealModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <GameModalShell
      zIndexClassName="z-50"
      overlayClassName="bg-bg-overlay px-4 backdrop-blur-md"
      panelClassName="w-full max-w-md rounded-3xl border border-line-strong bg-bg-surface p-5 shadow-pop"
      stopPanelClick
    >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
          {t("karta_ochildi")}
        </p>
        <h3 className="mt-1 text-xl font-bold text-ink-primary">{playerName}</h3>

        <div className="mt-5" style={{ perspective: 1200 }} key={animationKey}>
          <div
            className="animate-card-flip relative grid"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div
              className="col-start-1 row-start-1 grid place-items-center rounded-2xl border border-line-strong bg-bg-elevated p-4"
              style={
                {
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                } as CSSProperties
              }
            >
              <span className="text-4xl font-bold text-ink-muted">?</span>
            </div>
            <div
              className="col-start-1 row-start-1 rounded-2xl border border-brand/40 bg-brand-soft/40 p-4"
              style={
                {
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                } as CSSProperties
              }
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
                {t("label_yangi", { label: cardLabel })}
              </p>
              <p className="mt-2 text-base font-semibold leading-7 text-ink-primary">
                {newCardValue}
              </p>
            </div>
          </div>
        </div>

        {olderCards.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              {t("avval_ochilganlar")}
            </p>
            <ul className="mt-2 grid gap-2">
              {olderCards.map((card) => (
                <li
                  key={card.type}
                  className="rounded-xl border border-line-subtle bg-bg-base/60 px-3 py-2"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                    {card.label}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-ink-secondary">
                    {card.value}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
        >
          {t("tushundim")}
        </button>
    </GameModalShell>
  );
}
