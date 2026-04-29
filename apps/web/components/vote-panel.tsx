"use client";

import { useMemo, useState } from "react";

type VotePanelProps = {
  canVote: boolean;
  hasVoted: boolean;
  players: Array<{
    id: string;
    name: string;
    isAlive: boolean;
    visibleCards: Partial<Record<string, string>>;
  }>;
  meId?: string;
  onVote: (targetPlayerId: string) => void;
};

export function VotePanel({
  canVote,
  hasVoted,
  players,
  meId,
  onVote
}: VotePanelProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const options = useMemo(
    () => players.filter((player) => player.isAlive && player.id !== meId),
    [meId, players]
  );

  const selectedPlayer = options.find((player) => player.id === selectedPlayerId) ?? null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(7,10,20,0.98),rgba(2,6,23,0.98))] p-5 shadow-2xl shadow-black/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-red-200/70">
              Ovoz berish
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Kim bunkerda qolmasligi kerak?
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              {hasVoted
                ? "Siz ovoz berdingiz. Qolgan o'yinchilarni kuting."
                : canVote
                  ? "Ochilgan kartalarga qarab bitta o'yinchini tanlang."
                  : "Bu bosqichda siz faqat natijani kutasiz."}
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            Variantlar: {options.length}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {options.map((player) => (
            <button
              key={player.id}
              disabled={!canVote || hasVoted}
              onClick={() => setSelectedPlayerId(player.id)}
              className={`rounded-[1.5rem] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedPlayerId === player.id
                  ? "border-red-300/30 bg-red-500/10"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{player.name}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Nomzod
                  </p>
                </div>
                {selectedPlayerId === player.id ? (
                  <div className="rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-semibold text-red-100">
                    Tanlandi
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2">
                {Object.entries(player.visibleCards).length ? (
                  Object.entries(player.visibleCards).map(([key, value]) => (
                    <div key={key} className="rounded-[1rem] bg-slate-950/60 px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                        {formatCardLabel(key)}
                      </p>
                      <p className="mt-2 text-sm text-slate-100">{value}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1rem] bg-slate-950/60 px-3 py-3 text-sm text-slate-400">
                    Hali faqat majburiy kartalar ochilgan.
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {selectedPlayer
              ? `${selectedPlayer.name} tanlandi. Tasdiqlasangiz ovoz yuboriladi.`
              : "Avval bitta o'yinchini tanlang."}
          </p>
          <button
            disabled={!canVote || hasVoted || !selectedPlayerId}
            onClick={() => selectedPlayerId && onVote(selectedPlayerId)}
            className="rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Ovoz berishni tasdiqlash
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCardLabel(key: string) {
  switch (key) {
    case "PROFESSION":
      return "Kasb";
    case "HEALTH":
      return "Sog'liq";
    case "CHARACTER":
      return "Xarakter";
    case "SKILL":
      return "Ko'nikma";
    case "BAGGAGE":
      return "Bagaj";
    case "FACT":
      return "Fakt";
    default:
      return key;
  }
}
