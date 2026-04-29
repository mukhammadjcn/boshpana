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

  const primary = canStartGame
    ? { label: "O‘yinni boshlash", onClick: onStartGame }
    : canStartRound
      ? { label: "1-roundni boshlash", onClick: onStartRound }
      : canAdvanceTurn
        ? { label: advanceTurnLabel, onClick: onAdvanceTurn }
        : canStartVoting
          ? { label: "Ovoz berishni boshlash", onClick: onStartVoting }
          : null;

  const secondary = canSkipVoting && !canStartVoting
    ? { label: "Keyingi roundga", onClick: onSkipVoting }
    : canStartVoting && canSkipVoting
      ? { label: "Roundni o‘tkazib yuborish", onClick: onSkipVoting }
      : null;

  return (
    <div className="rounded-2xl border border-line-subtle bg-bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">Host paneli</p>
        <button
          type="button"
          onClick={onEndGame}
          className="text-xs font-medium text-bad hover:underline"
        >
          O‘yinni tugatish
        </button>
      </div>

      {primary || secondary ? (
        <div className="flex flex-wrap gap-2">
          {primary ? (
            <button
              onClick={primary.onClick}
              className="flex h-12 flex-1 min-w-[180px] items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-bg-base transition active:scale-[0.98]"
            >
              {primary.label}
            </button>
          ) : null}
          {secondary ? (
            <button
              onClick={secondary.onClick}
              className="flex h-12 items-center justify-center rounded-xl border border-line-strong bg-bg-elevated px-4 text-sm font-semibold text-ink-primary"
            >
              {secondary.label}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          Hozir host uchun action yo‘q. Keyingi fazani kuting.
        </p>
      )}
    </div>
  );
}
