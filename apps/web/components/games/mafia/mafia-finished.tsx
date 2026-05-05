"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n";
import { MafiaSituationArt } from "./mafia-situation-art";
import type { MafiaPublicState, MafiaRole } from "./mafia-types";

type Props = {
  state: MafiaPublicState;
};

function getRoleMeta(t: (text: string, vars?: Record<string, string | number>) => string): Record<
  MafiaRole,
  { label: string; tone: "ok" | "bad" | "brand" }
> {
  return {
    CITIZEN: { label: t("Oddiy aholi"), tone: "ok" },
    MAFIA: { label: "Mafia", tone: "bad" },
    SHERIFF: { label: t("Komisar"), tone: "brand" },
    DOCTOR: { label: t("Doktor"), tone: "ok" }
  };
}

// Yakuniy ekran — qaysi jamoa yutgani va hamma rollarning ochilishi.
// Bunkerning post-game yondashuviga o'xshash: banner + role reveal +
// bosh sahifaga qaytish tugmasi.
export function MafiaFinished({ state }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const winner = state.game.winner;
  const players = [...state.players].sort(
    (a, b) => a.seatOrder - b.seatOrder
  );
  const roleMeta = getRoleMeta(t);

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-5 pt-safe pb-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between pt-3">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            {t("O'yin yakunlandi")}
          </p>
          <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 font-mono text-xs">
            {state.room.code}
          </span>
        </header>

        <section
          className={`grid gap-3 rounded-3xl border p-6 text-center ${
            winner === "MAFIA"
              ? "border-bad/40 bg-bad/15"
              : "border-ok/40 bg-ok/15"
          }`}
        >
          {winner ? (
            <MafiaSituationArt
              src={winner === "MAFIA" ? "/mafiaimg.webp" : "/cityimg.webp"}
              alt={winner === "MAFIA" ? t("Mafia g'olib") : t("Shahar g'olib")}
              size="lg"
            />
          ) : null}
          <p
            className={`text-base font-semibold ${
              winner === "MAFIA" ? "text-bad" : "text-ok"
            }`}
          >
            {winner === "MAFIA"
              ? t("Mafia jamoasi g'olib")
              : winner === "CITY"
                ? t("Shahar g'olib")
                : t("O'yin to'xtatildi")}
          </p>
        </section>

        <section className="grid gap-2">
          <p className="text-sm font-semibold">{t("Barcha rollar")}</p>
          <ul className="grid gap-2">
            {players.map((p) => {
              const role = p.revealedRole;
              const meta = role ? roleMeta[role] : null;
              const toneClass = !meta
                ? "text-ink-muted"
                : meta.tone === "bad"
                  ? "text-bad"
                  : meta.tone === "ok"
                    ? "text-ok"
                    : "text-brand";
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-3"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold uppercase text-brand">
                    {p.name.slice(0, 2)}
                  </span>
                  <div className="flex-1 leading-tight">
                    <p
                      className={`text-sm font-semibold ${
                        p.isAlive ? "" : "line-through opacity-70"
                      }`}
                    >
                      {p.name}
                    </p>
                    <p className={`text-[11px] ${toneClass}`}>
                      {meta?.label ?? t("Rol noma'lum")}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wider ${
                      p.isAlive ? "text-ok" : "text-ink-muted"
                    }`}
                  >
                    {p.isAlive ? t("Tirik") : t("O'lgan")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <button
          type="button"
          onClick={() => router.push("/dashboard" as Route)}
          className="mt-auto flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98]"
        >
          {t("Bosh sahifaga qaytish")}
        </button>
      </div>
    </main>
  );
}
