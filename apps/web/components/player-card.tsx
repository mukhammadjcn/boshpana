"use client";

type PlayerCardProps = {
  name: string;
  isHost: boolean;
  isAlive: boolean;
  revealedCards: Partial<Record<string, string>>;
  isMe?: boolean;
  isCurrentTurn?: boolean;
};

export function PlayerCard({
  name,
  isHost,
  isAlive,
  revealedCards,
  isMe,
  isCurrentTurn
}: PlayerCardProps) {
  return (
    <div
      className={`rounded-[1.5rem] border p-4 transition ${
        isCurrentTurn
          ? "border-sky-300/30 bg-sky-400/10"
          : ""
      } ${
        isAlive
          ? "border-white/10 bg-white/[0.04]"
          : "border-red-400/20 bg-red-500/10 opacity-70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{name}</p>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
            {isMe ? "Siz" : isHost ? "Host" : "O'yinchi"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCurrentTurn ? (
            <div className="rounded-full bg-sky-400/20 px-3 py-1 text-[11px] font-semibold text-sky-100">
              Navbat
            </div>
          ) : null}
          <div
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              isAlive ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"
            }`}
          >
            {isAlive ? "Tirik" : "Chiqqan"}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {Object.entries(revealedCards).length ? (
          Object.entries(revealedCards).map(([key, value]) => (
            <div key={key} className="rounded-[1rem] bg-slate-900/65 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{key}</p>
              <p className="mt-2 text-sm leading-6 text-slate-100">{value}</p>
            </div>
          ))
        ) : (
          <p className="rounded-[1rem] bg-slate-900/60 px-3 py-3 text-sm text-slate-400">
            Hali hech narsa ochilmagan
          </p>
        )}
      </div>
    </div>
  );
}
