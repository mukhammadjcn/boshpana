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
    CITIZEN: { label: t("oddiy_aholi"), tone: "ok" },
    MAFIA: { label: t("mafia_2"), tone: "bad" },
    SHERIFF: { label: t("komisar_2"), tone: "brand" },
    DOCTOR: { label: t("doktor_2"), tone: "ok" }
  };
}

// Yakuniy ekran — qaysi jamoa yutgani va hamma rollarning ochilishi.
// Bunkerning post-game yondashuviga o'xshash: banner + role reveal +
// bosh sahifaga qaytish tugmasi.
export function MafiaFinished({ state }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const winner = state.game.winner;
  const stoppedByHost = winner == null;
  const players = [...state.players].sort(
    (a, b) => a.seatOrder - b.seatOrder
  );
  const roleMeta = getRoleMeta(t);

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-5 pt-safe pb-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between pt-3">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            {t("oyin_yakunlandi")}
          </p>
          <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 font-mono text-xs">
            {state.room.code}
          </span>
        </header>

        <section
          className={`grid gap-2 rounded-3xl border p-5 text-center ${
            stoppedByHost
              ? "border-line-strong bg-bg-surface"
              : "border-ok/40 bg-ok/10"
          }`}
        >
          <p
            className={`text-xs font-medium uppercase tracking-[0.25em] ${
              stoppedByHost ? "text-brand" : "text-ok"
            }`}
          >
            {stoppedByHost ? t("info") : t("success")}
          </p>
          <p className="text-xl font-bold text-ink-primary">
            {stoppedByHost
              ? t("oyin_boshqaruvchi_tomonidan_toxtatildi")
              : t("oyin_tugadi")}
          </p>
          <p className="text-sm text-ink-secondary">
            {stoppedByHost
              ? t("barcha_rollar_ochildi_kim_kim_ekanini_koring")
              : t("yakuniy_natijalar_va_rollar_pastda_korsatildi")}
          </p>
        </section>

        {winner ? (
          <section
            className={`grid gap-3 rounded-3xl border p-6 text-center ${
              winner === "MAFIA"
                ? "border-bad/40 bg-bad/15"
                : "border-ok/40 bg-ok/15"
            }`}
          >
            <MafiaSituationArt
              src={winner === "MAFIA" ? "/mafiaimg.webp" : "/cityimg.webp"}
              alt={winner === "MAFIA" ? t("mafia_golib") : t("shahar_golib")}
              size="lg"
            />
            <p
              className={`text-base font-semibold ${
                winner === "MAFIA" ? "text-bad" : "text-ok"
              }`}
            >
              {winner === "MAFIA"
                ? t("mafia_jamoasi_golib")
                : t("shahar_golib")}
            </p>
          </section>
        ) : null}

        <section className="grid gap-2">
          <p className="text-sm font-semibold">{t("barcha_rollar")}</p>
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
                      {meta?.label ?? t("rol_noma_lum")}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wider ${
                      p.isAlive ? "text-ok" : "text-ink-muted"
                    }`}
                  >
                    {p.isAlive ? t("tirik") : t("olgan")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <button
          type="button"
          onClick={() => router.push("/dashboard" as Route)}
          className="mt-auto flex h-12 w-full items-center justify-center rounded-2xl bg-ok text-sm font-semibold text-bg-base transition active:scale-[0.98]"
        >
          {t("bosh_sahifaga_qaytish")}
        </button>
      </div>
    </main>
  );
}
