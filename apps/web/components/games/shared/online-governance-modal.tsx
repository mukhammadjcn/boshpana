"use client";

import { useI18n } from "@/lib/i18n";

import type { OnlineProposal } from "../bunker/bunker-types";

type Props = {
  proposal: OnlineProposal | null;
  mePlayerId: string | null;
  onClose?: () => void;
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
};

export function OnlineGovernanceModal({
  proposal,
  mePlayerId,
  onClose,
  onApprove,
  onReject
}: Props) {
  const { t } = useI18n();
  if (!proposal || !mePlayerId) return null;

  const hasVoted =
    proposal.approvals.includes(mePlayerId) ||
    proposal.rejections.includes(mePlayerId);

  const title =
    proposal.kind === "END_GAME"
      ? t("oyinni_tugatishni_istaysizmi")
      : t("name_ni_oyindan_chiqarishga_rozi_bolasizmi", {
          name: proposal.targetName ?? t("oyinchi_2")
        });
  const description =
    proposal.kind === "END_GAME"
      ? t("name_oyinni_tugatishni_taklif_qildi", {
          name: proposal.proposerName
        })
      : t("name_kick_ovozini_boshladi_target_uchun", {
          name: proposal.proposerName,
          target: proposal.targetName ?? t("oyinchi_2")
        });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-bg-overlay backdrop-blur-md sm:items-center"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label={t("yopish")}
      />
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl border-t border-line-subtle bg-bg-surface p-6 pb-safe shadow-pop sm:rounded-3xl sm:border">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
          {proposal.kind === "END_GAME" ? t("ovoz_berish") : t("kick_ovozi")}
        </p>
        <h2 className="mt-2 text-xl font-bold leading-snug text-ink-primary">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink-secondary">
          {description}
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          {t("rozilar_count_kerak_majority", {
            count: proposal.approvals.length,
            majority: proposal.majority
          })}
        </p>
        <div className="mt-6 grid gap-2">
          <button
            type="button"
            disabled={hasVoted}
            onClick={() => onApprove(proposal.id)}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
          >
            {hasVoted ? t("ovozingiz_tasdiqlandi") : t("ha_rozi")}
          </button>
          <button
            type="button"
            disabled={hasVoted}
            onClick={() => onReject(proposal.id)}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-bg-elevated text-sm font-semibold text-ink-primary disabled:opacity-50"
          >
            {t("yoq_qarshiman")}
          </button>
        </div>
      </div>
    </div>
  );
}
