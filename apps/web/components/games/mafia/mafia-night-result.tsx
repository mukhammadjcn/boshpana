"use client";

import { useEffect, useState } from "react";

import { MafiaSituationArt } from "./mafia-situation-art";
import type { MafiaPublicState, MafiaRole } from "./mafia-types";

type Props = {
  state: MafiaPublicState;
};

const roleLabel: Record<MafiaRole, string> = {
  CITIZEN: "Oddiy aholi",
  MAFIA: "Mafia",
  SHERIFF: "Komisar",
  DOCTOR: "Doktor"
};

// Tun yakunlandi — natijalarni ketma-ket ko'rsatamiz. Doktor saqlab
// qolgan bo'lsa, "Doktor 1 fuqaroni saqlab qoldi" matni chiqadi
// (mafia/komisar nishoni bo'lgan ismni oshkor qilmaymiz). Aks holda
// qurbonlarni 1 sek interval bilan birin-ketin ko'rsatib boramiz.
export function MafiaNightResult({ state }: Props) {
  const { game, players } = state;
  const victims = game.lastNightVictims;
  const [revealedCount, setRevealedCount] = useState(0);

  // Reset when night number changes (next round).
  useEffect(() => {
    setRevealedCount(0);
  }, [game.nightNumber]);

  // Ketma-ket reveal — har 1.2 sek'da bittasini ochamiz. Animatsiyaning
  // o'zi animate-fade-in CSS class orqali boradi.
  useEffect(() => {
    if (revealedCount >= victims.length) return;
    const timer = window.setTimeout(() => {
      setRevealedCount((c) => c + 1);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [revealedCount, victims.length]);

  const peaceful = victims.length === 0 && !game.lastNightDoctorSaved;

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-5 pt-safe pb-safe sm:px-6 lg:px-8">
        <header className="flex items-center justify-between pt-3">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand">
            Tong otdi · #{game.nightNumber}
          </p>
          <span className="rounded-full border border-line-strong bg-bg-surface px-3 py-1 font-mono text-xs">
            {state.room.code}
          </span>
        </header>

        <section className="grid gap-4">
          <h1 className="text-2xl font-bold sm:text-3xl">Tunda nima bo'ldi?</h1>

          {peaceful ? (
            <div className="grid gap-3 rounded-3xl border border-line-strong bg-bg-surface p-6 text-center">
              <MafiaSituationArt src="/dayimg.webp" alt="Tun tinch o'tdi" />
              <p className="text-base font-semibold">Tun tinch o'tdi</p>
              <p className="text-sm text-ink-muted">Hech kim shikastlanmadi.</p>
            </div>
          ) : null}

          {game.lastNightDoctorSaved ? (
            <div className="grid gap-3 rounded-3xl border border-ok/30 bg-ok/10 p-5 text-center animate-fade-in">
              <MafiaSituationArt src="/doctorimg.webp" alt="Doktor saqlab qoldi" />
              <p className="text-base font-semibold text-ok">
                Doktor 1 fuqaroni saqlab qoldi
              </p>
              <p className="text-xs text-ink-muted">
                Hujum sodir bo'ldi, lekin o'qimishli doktor o'sha kishini
                davolagan ekan.
              </p>
            </div>
          ) : null}

          {victims.slice(0, revealedCount).map((v) => {
            const player = players.find((p) => p.id === v.playerId);
            return (
              <div
                key={v.playerId}
                className="grid gap-3 rounded-3xl border border-bad/30 bg-bad/10 p-5 text-center animate-fade-in"
              >
                <MafiaSituationArt src="/diedimg.webp" alt="Qurbon" />
                <p className="text-base font-semibold text-bad">
                  {player?.name ?? "?"} halok bo'ldi
                </p>
                <p className="text-xs text-ink-muted">
                  Roli: {roleLabel[v.role]}
                </p>
              </div>
            );
          })}

          {revealedCount < victims.length ? (
            <div className="text-center text-xs text-ink-muted">
              Ochilmoqda…
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
