"use client";

type PlayerCardProps = {
  name: string;
  isHost: boolean;
  isAlive: boolean;
  revealedCards: Partial<Record<string, string>>;
  isMe?: boolean;
};

export function PlayerCard({
  name,
  isHost,
  isAlive,
  revealedCards,
  isMe
}: PlayerCardProps) {
  return (
    <div
      className={`rounded-4xl border p-4 shadow-lg transition ${
        isAlive
          ? "border-white/10 bg-white/5"
          : "border-red-400/20 bg-red-500/10 opacity-70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{name}</p>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            {isMe ? "Siz" : isHost ? "Host" : "O'yinchi"}
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isAlive ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"
          }`}
        >
          {isAlive ? "Tirik" : "Chiqqan"}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {Object.entries(revealedCards).length ? (
          Object.entries(revealedCards).map(([key, value]) => (
            <div key={key} className="rounded-3xl bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">{key}</p>
              <p className="mt-1 text-sm text-slate-100">{value}</p>
            </div>
          ))
        ) : (
          <p className="rounded-3xl bg-slate-900/60 px-3 py-4 text-sm text-slate-400">
            Hali hech narsa ochilmagan
          </p>
        )}
      </div>
    </div>
  );
}
