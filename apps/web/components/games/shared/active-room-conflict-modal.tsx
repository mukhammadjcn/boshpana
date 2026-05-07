"use client";

import { useI18n } from "@/lib/i18n";

import { ConfirmModal } from "@/components/confirm-modal";

import type { ActiveRoomSummary } from "./online-room-utils";

type Props = {
  activeRoom: ActiveRoomSummary | null;
  open: boolean;
  busy?: boolean;
  onContinue: () => void;
  onStartNew: () => void;
};

function roomLabel(activeRoom: ActiveRoomSummary, t: (key: string) => string) {
  const game =
    activeRoom.gameType === "MAFIA" ? t("mafia_2") : t("bunker_2");
  const visibility =
    activeRoom.visibility === "PUBLIC" ? t("tab_public") : t("tab_private");
  return `${game} · ${visibility} · ${activeRoom.code}`;
}

export function ActiveRoomConflictModal({
  activeRoom,
  open,
  busy = false,
  onContinue,
  onStartNew,
}: Props) {
  const { t } = useI18n();

  return (
    <ConfirmModal
      open={open}
      busy={busy}
      title={t("aktiv_oyiningiz_bor")}
      description={
        activeRoom
          ? `${t("aktiv_oyin_tavsifi")} ${roomLabel(activeRoom, t)}`
          : t("aktiv_oyin_tavsifi")
      }
      confirmLabel={t("yangi_oyinni_boshlash")}
      cancelLabel={t("davom_ettirish")}
      tone="warn"
      onConfirm={onStartNew}
      onClose={onContinue}
    />
  );
}
