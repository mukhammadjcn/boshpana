"use client";

import { useMemo } from "react";

import { MafiaSituationArt } from "./mafia-situation-art";
import type {
  MafiaNightActionType,
  MafiaPublicState,
  MafiaRole
} from "./mafia-types";

type Props = {
  state: MafiaPublicState;
  onSubmit: (
    action: MafiaNightActionType,
    targetPlayerId: string | null
  ) => void;
};

const roleHeader: Record<
  MafiaRole,
  { title: string; subtitle: string; accent: string }
> = {
  CITIZEN: {
    title: "Aholi",
    subtitle: "Tunda fikringiz so'raladi",
    accent: "text-ok"
  },
  MAFIA: {
    title: "Mafia",
    subtitle: "Sheriklaringiz bilan birga nishon tanlang",
    accent: "text-bad"
  },
  SHERIFF: {
    title: "Komisar",
    subtitle: "Tekshiring yoki o'q uzing",
    accent: "text-brand"
  },
  DOCTOR: {
    title: "Doktor",
    subtitle: "Birovni davolab, mafia/komisar nishonidan saqlang",
    accent: "text-ok"
  }
};

// Tun ekrani — har bir o'yinchi 20 soniyada bittasini tanlaydi. Vaqt
// strict 20s — server resolveNight'da yakunlaydi. UI mafia/komisar/
// doktorlarga real tanlov beradi, aholiga esa pufak savol (anti-cheat).
export function MafiaNight({ state, onSubmit }: Props) {
  const { game, me, players } = state;
  const role = me?.role ?? null;

  const aliveTargets = useMemo(
    () =>
      players.filter(
        (p) => p.isAlive && (role === "DOCTOR" ? true : p.id !== me?.id)
      ),
    [players, role, me?.id]
  );

  if (!me || !role) {
    return (
      <NightShell remaining={game.remainingSeconds} night={game.nightNumber}>
        <p className="text-center text-sm text-ink-muted">
          O'yinchi topilmadi.
        </p>
      </NightShell>
    );
  }

  if (!me.isAlive) {
    return (
      <NightShell remaining={game.remainingSeconds} night={game.nightNumber}>
        <div className="grid gap-3 rounded-3xl border border-line-strong bg-bg-surface p-6 text-center">
          <MafiaSituationArt src="/ghostimg.webp" alt="O'lgan o'yinchi" />
          <p className="text-base font-semibold">Siz o'lgansiz</p>
          <p className="text-sm text-ink-muted">
            Tomoshabin sifatida tunni kutib turing.
          </p>
        </div>
      </NightShell>
    );
  }

  const header = roleHeader[role];

  return (
    <NightShell remaining={game.remainingSeconds} night={game.nightNumber}>
      <div className="grid gap-1 text-center">
        <p
          className={`text-xs font-medium uppercase tracking-[0.25em] ${header.accent}`}
        >
          {header.title}
        </p>
        <h1 className="text-xl font-bold sm:text-2xl">{header.subtitle}</h1>
      </div>

      {role === "MAFIA" ? (
        <MafiaView
          state={state}
          aliveTargets={aliveTargets}
          onSubmit={onSubmit}
        />
      ) : null}
      {role === "SHERIFF" ? (
        <SheriffView
          state={state}
          aliveTargets={aliveTargets}
          onSubmit={onSubmit}
        />
      ) : null}
      {role === "DOCTOR" ? (
        <DoctorView
          state={state}
          aliveTargets={aliveTargets}
          onSubmit={onSubmit}
        />
      ) : null}
      {role === "CITIZEN" ? (
        <CitizenView
          state={state}
          aliveTargets={aliveTargets}
          onSubmit={onSubmit}
        />
      ) : null}
    </NightShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Layout shell — shared header + 20s timer
// ─────────────────────────────────────────────────────────────────────

function NightShell({
  remaining,
  night,
  children
}: {
  remaining: number;
  night: number;
  children: React.ReactNode;
}) {
  const fraction = Math.max(0, Math.min(1, remaining / 20));
  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-5 pt-safe pb-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between pt-3">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-ink-muted">
            Tun · #{night}
          </p>
          <span
            className={`rounded-full border px-3 py-1 font-mono text-sm font-semibold ${
              remaining <= 5
                ? "border-bad/40 bg-bad/15 text-bad"
                : "border-line-strong bg-bg-surface text-brand"
            }`}
          >
            {String(remaining).padStart(2, "0")}s
          </span>
        </header>

        <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
          <div
            className={`h-full transition-all ${
              remaining <= 5 ? "bg-bad" : "bg-brand"
            }`}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>

        <div className="flex flex-1 flex-col gap-5">{children}</div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Mafia view — pick a target; teammates' picks visible in real-time
// ─────────────────────────────────────────────────────────────────────

function MafiaView({
  state,
  aliveTargets,
  onSubmit
}: {
  state: MafiaPublicState;
  aliveTargets: MafiaPublicState["players"];
  onSubmit: Props["onSubmit"];
}) {
  const me = state.me!;
  const teammates = state.players.filter(
    (p) => me.mafiaTeammates.includes(p.id) && p.isAlive
  );
  // Each pick row maps actor → target.
  const picksByActor = new Map(
    state.mafiaPicks.map((p) => [p.actorPlayerId, p.targetPlayerId])
  );
  const myTarget = me.pendingNightTargetId;

  return (
    <>
      {teammates.length > 0 ? (
        <section className="rounded-2xl border border-bad/30 bg-bad/10 p-3 text-xs">
          <p className="text-[11px] font-medium uppercase tracking-wider text-bad">
            Sheriklaringizning tanlovi
          </p>
          <ul className="mt-2 grid gap-1">
            {teammates.map((t) => {
              const targetId = picksByActor.get(t.id);
              const target = state.players.find((p) => p.id === targetId);
              return (
                <li key={t.id} className="flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-ink-secondary">
                    {target ? `→ ${target.name}` : "tanlamagan"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <TargetGrid
        title="Kimni o'ldirmoqchisiz?"
        targets={aliveTargets}
        selectedId={myTarget}
        onPick={(id) => onSubmit("MAFIA_KILL", id)}
        excludeIds={[me.id, ...me.mafiaTeammates]}
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
  onSubmit
}: {
  state: MafiaPublicState;
  aliveTargets: MafiaPublicState["players"];
  onSubmit: Props["onSubmit"];
}) {
  const me = state.me!;
  const shotsLeft = state.game.sheriffShotsRemaining;
  const mode: "CHECK" | "SHOOT" =
    me.pendingNightAction === "SHERIFF_SHOOT" ? "SHOOT" : "CHECK";

  return (
    <>
      <section className="grid grid-cols-2 gap-2 rounded-2xl border border-line-subtle bg-bg-surface p-2">
        <ModeButton
          active={mode === "CHECK"}
          label="Tekshirish"
          subtitle="Cheksiz"
          onClick={() => onSubmit("SHERIFF_CHECK", me.pendingNightTargetId)}
        />
        <ModeButton
          active={mode === "SHOOT"}
          label="O'q uzish"
          subtitle={`${shotsLeft} o'q qoldi`}
          disabled={shotsLeft === 0}
          onClick={() => onSubmit("SHERIFF_SHOOT", me.pendingNightTargetId)}
        />
      </section>

      {me.sheriffChecks.length > 0 ? (
        <section className="rounded-2xl border border-line-subtle bg-bg-surface p-3 text-xs">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Tekshirilganlar tarixi
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
                  <span
                    className={c.isMafia ? "text-bad" : "text-ok"}
                  >
                    {c.isMafia ? "Mafia" : "Begunoh"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <TargetGrid
        title={mode === "CHECK" ? "Kimni tekshirasiz?" : "Kimga o'q uzasiz?"}
        targets={aliveTargets}
        selectedId={me.pendingNightTargetId}
        onPick={(id) =>
          onSubmit(mode === "CHECK" ? "SHERIFF_CHECK" : "SHERIFF_SHOOT", id)
        }
        excludeIds={[me.id]}
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
  onSubmit
}: {
  state: MafiaPublicState;
  aliveTargets: MafiaPublicState["players"];
  onSubmit: Props["onSubmit"];
}) {
  const me = state.me!;
  const selfHealsLeft = state.game.doctorSelfHealsRemaining;
  // Self-heal is allowed only if the doctor still has self-heal credit.
  const excludeIds = selfHealsLeft > 0 ? [] : [me.id];

  return (
    <>
      <p className="rounded-2xl border border-line-subtle bg-bg-surface px-3 py-2 text-xs text-ink-muted">
        O'zingizni: {selfHealsLeft} marta davolashingiz mumkin · Boshqalarni
        cheksiz
      </p>
      <TargetGrid
        title="Kimni davolaysiz?"
        targets={aliveTargets}
        selectedId={me.pendingNightTargetId}
        onPick={(id) => onSubmit("DOCTOR_HEAL", id)}
        excludeIds={excludeIds}
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
  onSubmit
}: {
  state: MafiaPublicState;
  aliveTargets: MafiaPublicState["players"];
  onSubmit: Props["onSubmit"];
}) {
  const me = state.me!;
  const question = me.citizenQuestion;
  const action: MafiaNightActionType =
    question === "GUESS_DOCTOR_HEAL"
      ? "CITIZEN_GUESS_HEAL"
      : "CITIZEN_GUESS_KILL";
  const prompt =
    question === "GUESS_DOCTOR_HEAL"
      ? "Sizningcha doktor bu tunda kimni davolaydi?"
      : "Sizningcha mafia bu tunda kimni o'ldiradi?";

  return (
    <TargetGrid
      title={prompt}
      targets={aliveTargets}
      selectedId={me.pendingNightTargetId}
      onPick={(id) => onSubmit(action, id)}
      excludeIds={[me.id]}
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
  excludeIds
}: {
  title: string;
  targets: MafiaPublicState["players"];
  selectedId: string | null;
  onPick: (id: string) => void;
  excludeIds: string[];
}) {
  const filtered = targets.filter((t) => !excludeIds.includes(t.id));
  return (
    <section className="grid gap-2">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((p) => {
          const selected = selectedId === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p.id)}
                className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm transition active:scale-[0.98] ${
                  selected
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-line-strong bg-bg-surface text-ink-primary"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold uppercase ${
                    selected ? "bg-brand text-bg-base" : "bg-brand-soft text-brand"
                  }`}
                >
                  {p.name.slice(0, 2)}
                </span>
                <span className="flex-1 truncate font-medium">{p.name}</span>
                {selected ? <span className="text-xs">✓</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ModeButton({
  active,
  label,
  subtitle,
  disabled,
  onClick
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
        active
          ? "bg-brand text-bg-base"
          : "bg-bg-base text-ink-primary"
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

