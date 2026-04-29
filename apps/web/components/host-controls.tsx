"use client";

type HostControlsProps = {
  isHost: boolean;
  canStartGame: boolean;
  canStartRound: boolean;
  canAdvanceTurn: boolean;
  advanceTurnLabel?: string;
  canStartVoting: boolean;
  canSkipVoting: boolean;
  onStartGame: () => void;
  onStartRound: () => void;
  onAdvanceTurn: () => void;
  onStartVoting: () => void;
  onSkipVoting: () => void;
  onEndGame: () => void;
};

export function HostControls({
  isHost,
  canStartGame,
  canStartRound,
  canAdvanceTurn,
  advanceTurnLabel = "Keyingi o‘yinchi",
  canStartVoting,
  canSkipVoting,
  onStartGame,
  onStartRound,
  onAdvanceTurn,
  onStartVoting,
  onSkipVoting,
  onEndGame
}: HostControlsProps) {
  if (!isHost) {
    return null;
  }

  return (
    <div className="rounded-[1.75rem] border border-orange-300/15 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-orange-100/70">
            Host panel
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Faqat kerakli action’lar hozir ko‘rinadi.
          </p>
        </div>
        <button
          onClick={onEndGame}
          className="rounded-full border border-red-300/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100"
        >
          O‘yinni tugatish
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {canStartGame ? (
          <ActionButton label="O‘yinni boshlash" onClick={onStartGame} primary />
        ) : null}
        {canStartRound ? (
          <ActionButton label="1-round boshlash" onClick={onStartRound} primary />
        ) : null}
        {canAdvanceTurn ? (
          <ActionButton label={advanceTurnLabel} onClick={onAdvanceTurn} />
        ) : null}
        {canStartVoting ? (
          <ActionButton label="Ovoz berishni boshlash" onClick={onStartVoting} />
        ) : null}
        {canSkipVoting ? (
          <ActionButton label="Keyingi roundga o‘tish" onClick={onSkipVoting} />
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary = false
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
        primary
          ? "bg-orange-500 text-slate-950 hover:bg-orange-400"
          : "border border-white/10 bg-white/8 text-white hover:bg-white/12"
      }`}
    >
      {label}
    </button>
  );
}
