"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { JoinRoomModal } from "@/components/join-room-modal";
import { useI18n } from "@/lib/i18n";
import { GameActionModal } from "@/components/games/shared/game-action-modal";
import { MafiaSituationArt } from "./mafia-situation-art";
import type {
  MafiaNightActionType,
  MafiaPublicState,
  MafiaRole,
} from "./mafia-types";

type Props = {
  state: MafiaPublicState;
  onSubmit: (
    action: MafiaNightActionType,
    targetPlayerId: string | null
  ) => void;
  submitPending?: boolean;
  confirmNightPending?: boolean;
  onConfirmNight?: () => void;
  onOpenRole?: () => void;
};

function getRoleHeader(
  t: (text: string, vars?: Record<string, string | number>) => string,
): Record<MafiaRole, { title: string; subtitle: string; accent: string }> {
  return {
    CITIZEN: {
      title: t("aholi"),
      subtitle: t("tunda_fikringiz_soraladi"),
      accent: "text-ok",
    },
    MAFIA: {
      title: t("mafia_2"),
      subtitle: t("sheriklaringiz_bilan_birga_nishon_tanlang"),
      accent: "text-bad",
    },
    SHERIFF: {
      title: t("komisar_2"),
      subtitle: t("tekshiring_yoki_oq_uzing"),
      accent: "text-brand",
    },
    DOCTOR: {
      title: t("doktor_2"),
      subtitle: t("birovni_davolab_mafia_komisar_nishonidan_b5bd"),
      accent: "text-ok",
    },
  };
}

// Tun ekrani — har bir o'yinchi 60 soniyada bittasini tanlaydi. Vaqt
// strict 60s — server resolveNight'da yakunlaydi. UI mafia/komisar/
// doktorlarga real tanlov beradi, aholiga esa pufak savol (anti-cheat).
export function MafiaNight({
  state,
  onSubmit,
  submitPending = false,
  confirmNightPending = false,
  onConfirmNight,
  onOpenRole
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [joinOpen, setJoinOpen] = useState(false);
  const { game, me, players } = state;
  const role = me?.role ?? null;
  const roleHeader = getRoleHeader(t);
  const confirmDisabled = !me?.pendingNightTargetId || state.night.confirmedByMe;
  const helper = !me || !role
    ? !me
      ? t("bu_sessiya_hozirgi_oyinchi_bilan_aec7")
      : t("oyin_davom_etyapti_lekin_siz_6857")
    : !me.isAlive
      ? t("tomoshabin_sifatida_tunni_kuzating_kimlar_1d03")
      : state.night.confirmedByMe
        ? t("natijani_kutmoqdasiz")
        : roleHeader[role].subtitle;

  const aliveTargets = useMemo(
    () =>
      players.filter(
        (p) => p.isAlive && (role === "DOCTOR" ? true : p.id !== me?.id)
      ),
    [players, role, me?.id]
  );

  if (!me || !role) {
    const title = !me
      ? t("siz_bu_oyinda_topilmadingiz")
      : t("sizning_rolingiz_yuklanmadi");
    const description = !me
      ? t("bu_sessiya_hozirgi_oyinchi_bilan_aec7")
      : t("oyin_davom_etyapti_lekin_siz_6857");

    return (
      <GameActionModal
        sectionLabel={t("tun_number_night", { night: game.nightNumber })}
        helper={helper}
        accentTone="warn"
        secondsLeft={game.remainingSeconds}
        timerVariant={game.remainingSeconds <= 5 ? "danger" : "default"}
        badge={
          <span className="inline-flex items-center rounded-full border border-line-strong bg-bg-elevated px-3 py-1.5 font-mono text-sm font-semibold text-ink-secondary">
            {state.room.code}
          </span>
        }
        footer={
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="flex h-14 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {t("yangi_xonaga_qoshilish")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex h-14 items-center justify-center rounded-2xl border border-line-strong bg-bg-surface px-4 text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
            >
              {t("bosh_sahifaga_qaytish")}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 rounded-3xl border border-line-strong bg-bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warn/12 text-warn">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
            </svg>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-warn">
              {t("tungi_holat_ochilmadi")}
            </p>
            <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
            <p className="text-sm leading-7 text-ink-muted">{description}</p>
          </div>

          <div className="rounded-2xl border border-line-subtle bg-bg-base px-4 py-3 text-left">
            <p className="text-xs text-ink-muted">{t("room_code")}</p>
            <p className="mt-1 font-mono text-xl font-semibold tracking-[0.28em] text-ink-primary">
              {state.room.code}
            </p>
          </div>
        </div>

        <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
      </GameActionModal>
    );
  }

  if (!me.isAlive) {
    return (
      <GameActionModal
        sectionLabel={t("tun_number_night", { night: game.nightNumber })}
        helper={helper}
        accentTone="muted"
        secondsLeft={game.remainingSeconds}
        timerVariant={game.remainingSeconds <= 5 ? "danger" : "default"}
        badge={
          <span className="inline-flex items-center rounded-full border border-line-strong bg-bg-elevated px-3 py-1.5 font-mono text-sm font-semibold text-ink-secondary">
            {state.night.confirmations.confirmed} / {state.night.confirmations.total}
          </span>
        }
      >
        <SpectatorPanel
          players={players}
          title={t("siz_olgansiz")}
          subtitle={t("tomoshabin_sifatida_tunni_kuzating_kimlar_1d03")}
        />
      </GameActionModal>
    );
  }

  const header = roleHeader[role];

  return (
    <GameActionModal
      sectionLabel={t("tun_number_night", { night: game.nightNumber })}
      helper={helper}
      accentTone={
        role === "MAFIA" ? "bad" : role === "DOCTOR" ? "brand" : "warn"
      }
      secondsLeft={game.remainingSeconds}
      timerVariant={
        state.night.confirmedByMe
          ? "muted"
          : game.remainingSeconds <= 5
            ? "danger"
            : "default"
      }
      badge={
        <span
          className={`inline-flex items-center rounded-full border border-line-strong bg-bg-elevated px-3 py-1.5 text-sm font-semibold ${header.accent}`}
        >
          {header.title}
        </span>
      }
      footer={
        <div
          className={`grid gap-2 ${
            onOpenRole ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"
          }`}
        >
          <button
            type="button"
            onClick={onConfirmNight}
            disabled={confirmDisabled || confirmNightPending}
            className="flex h-14 min-w-0 items-center justify-center rounded-2xl bg-brand px-4 text-base font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-40"
          >
            {confirmNightPending
              ? t("yuborilmoqda")
              : state.night.confirmedByMe
                ? t("tasdiqlandi")
                : me.pendingNightTargetId
                  ? t("tungi_qarorni_tasdiqlash")
                  : t("nishonni_tanlang")}
          </button>
          {onOpenRole ? (
            <button
              type="button"
              onClick={onOpenRole}
              className="flex h-14 min-w-[132px] items-center justify-center rounded-2xl border border-line-strong bg-bg-surface px-4 text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
            >
              {t("mening_kartam")}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="mb-4 rounded-2xl border border-line-subtle bg-bg-surface px-4 py-3">
        <p className={`text-[11px] font-medium uppercase tracking-[0.24em] ${header.accent}`}>
          {header.title}
        </p>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          {header.subtitle}
        </p>
      </div>

      {role === "MAFIA" ? (
        <MafiaView
          state={state}
          aliveTargets={aliveTargets}
          onSubmit={onSubmit}
          submitPending={submitPending}
        />
      ) : null}
      {role === "SHERIFF" ? (
        <SheriffView
          state={state}
          aliveTargets={aliveTargets}
          onSubmit={onSubmit}
          submitPending={submitPending}
        />
      ) : null}
      {role === "DOCTOR" ? (
        <DoctorView
          state={state}
          aliveTargets={aliveTargets}
          onSubmit={onSubmit}
          submitPending={submitPending}
        />
      ) : null}
      {role === "CITIZEN" ? (
        <CitizenView
          state={state}
          aliveTargets={aliveTargets}
          onSubmit={onSubmit}
          submitPending={submitPending}
        />
      ) : null}
      <div className="mt-4 rounded-2xl border border-line-subtle bg-bg-surface px-4 py-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          {t("tasdiqlanganlar")}
        </p>
        <p className="mt-1 font-mono text-lg font-semibold text-brand">
          {state.night.confirmations.confirmed} / {state.night.confirmations.total}
        </p>
      </div>
    </GameActionModal>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Mafia view — pick a target; teammates' picks visible in real-time
// ─────────────────────────────────────────────────────────────────────

function MafiaView({
  state,
  aliveTargets,
  onSubmit,
  submitPending = false
}: {
  state: MafiaPublicState;
  aliveTargets: MafiaPublicState["players"];
  onSubmit: Props["onSubmit"];
  submitPending?: boolean;
}) {
  const { t } = useI18n();
  const me = state.me!;
  const teammates = state.players.filter(
    (p) => me.mafiaTeammates.includes(p.id) && p.isAlive,
  );
  const locked = state.night.confirmedByMe;
  // Each pick row maps actor → target.
  const picksByActor = new Map(
    state.mafiaPicks.map((p) => [p.actorPlayerId, p.targetPlayerId]),
  );
  const myTarget = me.pendingNightTargetId;

  return (
    <>
      {teammates.length > 0 ? (
        <section className="rounded-2xl border border-bad/30 bg-bad/10 p-3 text-xs">
          <p className="text-[11px] font-medium uppercase tracking-wider text-bad">
            {t("sheriklaringizning_tanlovi")}
          </p>
          <ul className="mt-2 grid gap-1">
            {teammates.map((teammate) => {
              const targetId = picksByActor.get(teammate.id);
              const target = state.players.find((p) => p.id === targetId);
              return (
                <li
                  key={teammate.id}
                  className="flex items-center justify-between"
                >
                  <span className="font-medium">{teammate.name}</span>
                  <span className="text-ink-secondary">
                    {target ? `→ ${target.name}` : t("tanlamagan")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <TargetGrid
        title={t("kimni_oldirmoqchisiz")}
        targets={aliveTargets}
        selectedId={myTarget}
        onPick={(id) => onSubmit("MAFIA_KILL", id)}
        excludeIds={[me.id, ...me.mafiaTeammates]}
        disabled={locked}
        submitPending={submitPending}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sheriff view — toggle Check/Shoot, then pick a target
// ─────────────────────────────────────────────────────────────────────

function SheriffView({
  state,
  aliveTargets,
  onSubmit,
  submitPending = false
}: {
  state: MafiaPublicState;
  aliveTargets: MafiaPublicState["players"];
  onSubmit: Props["onSubmit"];
  submitPending?: boolean;
}) {
  const { t } = useI18n();
  const me = state.me!;
  const shotsLeft = state.game.sheriffShotsRemaining;
  const locked = state.night.confirmedByMe;
  const mode: "CHECK" | "SHOOT" =
    me.pendingNightAction === "SHERIFF_SHOOT" ? "SHOOT" : "CHECK";

  return (
    <>
      <section className="grid grid-cols-2 gap-2 rounded-2xl border border-line-subtle bg-bg-surface p-2">
        <ModeButton
          active={mode === "CHECK"}
          label={t("tekshirish")}
          subtitle={t("cheksiz")}
          disabled={locked}
          onClick={() => onSubmit("SHERIFF_CHECK", me.pendingNightTargetId)}
        />
        <ModeButton
          active={mode === "SHOOT"}
          label={t("oq_uzish")}
          subtitle={t("count_oq_qoldi", { count: shotsLeft })}
          disabled={shotsLeft === 0 || locked}
          onClick={() => onSubmit("SHERIFF_SHOOT", me.pendingNightTargetId)}
        />
      </section>

      {me.sheriffChecks.length > 0 ? (
        <section className="rounded-2xl border border-line-subtle bg-bg-surface p-3 text-xs">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {t("tekshirilganlar_tarixi")}
          </p>
          <ul className="mt-2 grid gap-1">
            {me.sheriffChecks.map((c) => {
              const target = state.players.find((p) => p.id === c.playerId);
              return (
                <li
                  key={`${c.nightNumber}-${c.playerId}`}
                  className="flex items-center justify-between"
                >
                  <span className="font-medium">
                    #{c.nightNumber} · {target?.name ?? "?"}
                  </span>
                  <span className={c.isMafia ? "text-bad" : "text-ok"}>
                    {c.isMafia ? "Mafia" : t("begunoh")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <TargetGrid
        title={mode === "CHECK" ? t("kimni_tekshirasiz") : t("kimga_oq_uzasiz")}
        targets={aliveTargets}
        selectedId={me.pendingNightTargetId}
        onPick={(id) =>
          onSubmit(mode === "CHECK" ? "SHERIFF_CHECK" : "SHERIFF_SHOOT", id)
        }
        excludeIds={[me.id]}
        disabled={locked}
        submitPending={submitPending}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Doctor view — pick a heal target (self allowed once)
// ─────────────────────────────────────────────────────────────────────

function DoctorView({
  state,
  aliveTargets,
  onSubmit,
  submitPending = false
}: {
  state: MafiaPublicState;
  aliveTargets: MafiaPublicState["players"];
  onSubmit: Props["onSubmit"];
  submitPending?: boolean;
}) {
  const { t } = useI18n();
  const me = state.me!;
  const selfHealsLeft = state.game.doctorSelfHealsRemaining;
  const locked = state.night.confirmedByMe;
  // Self-heal is allowed only if the doctor still has self-heal credit.
  const excludeIds = selfHealsLeft > 0 ? [] : [me.id];

  return (
    <>
      <p className="rounded-2xl border border-line-subtle bg-bg-surface px-3 py-2 text-xs text-ink-muted">
        {t("ozingizni_count_marta_davolashingiz_mumkin_8920", {
          count: selfHealsLeft,
        })}
      </p>
      <TargetGrid
        title={t("kimni_davolaysiz")}
        targets={aliveTargets}
        selectedId={me.pendingNightTargetId}
        onPick={(id) => onSubmit("DOCTOR_HEAL", id)}
        excludeIds={excludeIds}
        disabled={locked}
        submitPending={submitPending}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Citizen view — dummy guess prompt; tap doesn't affect outcome
// ─────────────────────────────────────────────────────────────────────

function CitizenView({
  state,
  aliveTargets,
  onSubmit,
  submitPending = false
}: {
  state: MafiaPublicState;
  aliveTargets: MafiaPublicState["players"];
  onSubmit: Props["onSubmit"];
  submitPending?: boolean;
}) {
  const { t } = useI18n();
  const me = state.me!;
  const locked = state.night.confirmedByMe;
  const question = me.citizenQuestion;
  const action: MafiaNightActionType =
    question === "GUESS_DOCTOR_HEAL"
      ? "CITIZEN_GUESS_HEAL"
      : "CITIZEN_GUESS_KILL";
  const prompt =
    question === "GUESS_DOCTOR_HEAL"
      ? t("sizningcha_doktor_bu_tunda_kimni_cd97")
      : t("sizningcha_mafia_bu_tunda_kimni_74d4");

  return (
    <TargetGrid
      title={prompt}
      targets={aliveTargets}
      selectedId={me.pendingNightTargetId}
      onPick={(id) => onSubmit(action, id)}
      excludeIds={[me.id]}
      disabled={locked}
      submitPending={submitPending}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────────────────

function TargetGrid({
  title,
  targets,
  selectedId,
  onPick,
  excludeIds,
  disabled = false,
  submitPending = false
}: {
  title: string;
  targets: MafiaPublicState["players"];
  selectedId: string | null;
  onPick: (id: string) => void;
  excludeIds: string[];
  disabled?: boolean;
  submitPending?: boolean;
}) {
  const { t } = useI18n();
  const [optimisticSelectedId, setOptimisticSelectedId] = useState<
    string | null
  >(selectedId);

  useEffect(() => {
    setOptimisticSelectedId(selectedId);
  }, [selectedId]);

  const filtered = targets.filter((t) => !excludeIds.includes(t.id));
  return (
    <section className="grid gap-2">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="grid gap-3">
        {filtered.map((p) => {
          const selected = optimisticSelectedId === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setOptimisticSelectedId(p.id);
                  onPick(p.id);
                }}
                disabled={disabled}
                className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.98] disabled:opacity-55 ${
                  selected
                    ? "border-brand bg-brand/12"
                    : "border-line-strong bg-bg-surface"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-ink-primary">
                      {p.name}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {selected
                        ? submitPending
                          ? t("yuborilmoqda")
                          : t("tanlandi")
                        : t("nishonni_tanlang")}
                    </p>
                  </div>
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                      selected
                        ? "border-brand bg-brand text-bg-base"
                        : "border-line-strong bg-bg-base text-transparent"
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SpectatorPanel({
  players,
  title,
  subtitle,
}: {
  players: MafiaPublicState["players"];
  title: string;
  subtitle: string;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 rounded-3xl border border-line-strong bg-bg-surface p-5">
      <div className="grid gap-3 text-center">
        <MafiaSituationArt src="/mafia/ghost.webp" alt={t("olgan_oyinchi")} />
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-ink-muted">{subtitle}</p>
      </div>

      <div className="grid gap-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-2xl border border-line-subtle bg-bg-base/60 px-3 py-2"
          >
            <span className="truncate text-sm font-medium">{player.name}</span>
            <span
              className={`text-[11px] font-medium uppercase tracking-wider ${
                player.isAlive ? "text-ok" : "text-bad"
              }`}
            >
              {player.isAlive ? t("tirik") : t("olgan")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  label,
  subtitle,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  subtitle: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
        active ? "bg-brand text-bg-base" : "bg-bg-base text-ink-primary"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] font-medium ${
          active ? "text-bg-base/80" : "text-ink-muted"
        }`}
      >
        {subtitle}
      </span>
    </button>
  );
}
