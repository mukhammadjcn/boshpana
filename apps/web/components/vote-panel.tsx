"use client";

type VotePanelProps = {
  canVote: boolean;
  hasVoted: boolean;
  players: Array<{
    id: string;
    name: string;
    isAlive: boolean;
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
  const options = players.filter((player) => player.isAlive && player.id !== meId);

  return (
    <div className="rounded-4xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">Ovoz berish</p>
          <p className="text-sm text-slate-400">
            {hasVoted ? "Siz ovoz berdingiz." : "Kim bunkerdan chiqishi kerak?"}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {options.map((player) => (
          <button
            key={player.id}
            disabled={!canVote || hasVoted}
            onClick={() => onVote(player.id)}
            className="rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-left text-sm font-medium text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {player.name}
          </button>
        ))}
      </div>
    </div>
  );
}
