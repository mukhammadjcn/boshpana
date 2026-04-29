"use client";

import type { GamePhase, RoomStatus } from "@/lib/types";

type HostControlsProps = {
  isHost: boolean;
  roomStatus: RoomStatus;
  phase: GamePhase;
  canStart: boolean;
  onStart: () => void;
  onNextPhase: () => void;
};

function getNextLabel(phase: GamePhase) {
  if (phase === "DISCUSSION") {
    return "Reveal bosqichini ochish";
  }

  if (phase === "REVEAL") {
    return "Voting bosqichini boshlash";
  }

  if (phase === "VOTING") {
    return "Ovozlarni yakunlash";
  }

  return "Keyingi qadam";
}

export function HostControls({
  isHost,
  roomStatus,
  phase,
  canStart,
  onStart,
  onNextPhase
}: HostControlsProps) {
  if (!isHost) {
    return null;
  }

  return (
    <div className="rounded-4xl border border-orange-300/20 bg-orange-400/10 p-4 shadow-glow">
      <p className="text-xs uppercase tracking-[0.3em] text-orange-100/80">Host panel</p>
      <div className="mt-3">
        {roomStatus === "LOBBY" ? (
          <button
            className="w-full rounded-full bg-orange-500 px-4 py-3 text-base font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            disabled={!canStart}
            onClick={onStart}
          >
            O'yinni boshlash
          </button>
        ) : (
          <button
            className="w-full rounded-full border border-orange-300/30 bg-slate-950/30 px-4 py-3 text-sm font-semibold text-orange-50"
            onClick={onNextPhase}
          >
            {getNextLabel(phase)}
          </button>
        )}
      </div>
    </div>
  );
}
