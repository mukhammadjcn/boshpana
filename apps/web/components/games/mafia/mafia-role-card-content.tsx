"use client";

import { useI18n } from "@/lib/i18n";
import type { MafiaPublicState, MafiaRole } from "./mafia-types";

export const mafiaRoleMeta: Record<
  MafiaRole,
  {
    title: string;
    team: string;
    blurb: string;
    accent: string;
    bgGradient: string;
  }
> = {
  CITIZEN: {
    title: "Oddiy aholi",
    team: "Shahar",
    blurb: "Mafiyani topib chetlatishga harakat qiling.",
    accent: "text-ok",
    bgGradient:
      "radial-gradient(circle at 50% 0%, rgba(34,197,94,0.18), transparent 55%)"
  },
  MAFIA: {
    title: "Mafia",
    team: "Mafia",
    blurb: "Tunda nishon tanlab, kunduzi yashirinib qoling.",
    accent: "text-bad",
    bgGradient:
      "radial-gradient(circle at 50% 0%, rgba(239,68,68,0.22), transparent 55%)"
  },
  SHERIFF: {
    title: "Komisar",
    team: "Shahar",
    blurb: "Tunda bittasini tekshiring yoki o'q uzing (2 ta o'q).",
    accent: "text-brand",
    bgGradient:
      "radial-gradient(circle at 50% 0%, rgba(244,168,58,0.22), transparent 55%)"
  },
  DOCTOR: {
    title: "Doktor",
    team: "Shahar",
    blurb: "Tunda kimnidir davolab, mafia/komisar nishonidan qutqaring.",
    accent: "text-ok",
    bgGradient:
      "radial-gradient(circle at 50% 0%, rgba(34,197,94,0.18), transparent 55%)"
  }
};

export function getMafiaRoleMeta(role: MafiaRole | null | undefined) {
  return role ? mafiaRoleMeta[role] : null;
}

export function MafiaRoleCardContent({
  state,
  className = ""
}: {
  state: MafiaPublicState;
  className?: string;
}) {
  const { t } = useI18n();
  const role = state.me?.role ?? null;
  const meta = role
    ? {
        CITIZEN: {
          ...mafiaRoleMeta.CITIZEN,
          title: t("oddiy_aholi"),
          team: t("shahar"),
          blurb: t("mafiyani_topib_chetlatishga_harakat_qiling")
        },
        MAFIA: {
          ...mafiaRoleMeta.MAFIA,
          team: "Mafia",
          blurb: t("tunda_nishon_tanlab_kunduzi_yashirinib_8b6c")
        },
        SHERIFF: {
          ...mafiaRoleMeta.SHERIFF,
          title: t("komisar_2"),
          team: t("shahar"),
          blurb: t("tunda_bittasini_tekshiring_yoki_oq_a880")
        },
        DOCTOR: {
          ...mafiaRoleMeta.DOCTOR,
          title: t("doktor_2"),
          team: t("shahar"),
          blurb: t("tunda_kimnidir_davolab_mafia_komisar_02b9")
        }
      }[role]
    : null;
  if (!role || !meta) return null;

  const teammateNames = (state.me?.mafiaTeammates ?? [])
    .map((id) => state.players.find((p) => p.id === id)?.name)
    .filter((name): name is string => !!name);

  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-3 p-6 text-center ${className}`}
    >
      <p
        className={`text-xs font-medium uppercase tracking-[0.25em] ${meta.accent}`}
      >
        {meta.team} jamoasi
      </p>
      <h2 className="text-3xl font-bold">{meta.title}</h2>
      <p className="max-w-xs text-sm leading-7 text-ink-secondary">
        {meta.blurb}
      </p>
      {role === "MAFIA" && teammateNames.length > 0 ? (
        <div className="mt-3 grid w-full gap-1 rounded-2xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm">
          <p className="text-[11px] font-medium uppercase tracking-wider text-bad">
            {t("sheriklaringiz")}
          </p>
          <p className="font-semibold text-ink-primary">
            {teammateNames.join(", ")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
