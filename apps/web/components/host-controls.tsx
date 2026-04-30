"use client";

type HostControlsProps = {
  isHost: boolean;
  isLobby?: boolean;
  canStartGame: boolean;
  canStartRound: boolean;
  canStartReveals: boolean;
  canAdvanceTurn: boolean;
  advanceTurnLabel?: string;
  canStartVoting: boolean;
  canSkipVoting: boolean;
  votingFinished: boolean;
  onStartGame: () => void;
  onStartRound: () => void;
  onStartReveals: () => void;
  onAdvanceTurn: () => void;
  onStartVoting: () => void;
  onSkipVoting: () => void;
  onEndGame: () => void;
};

export function HostControls({
  isHost,
  isLobby = false,
  canStartGame,
  canStartRound,
  canStartReveals,
  canAdvanceTurn,
  advanceTurnLabel = "Keyingi o‘yinchi",
  canStartVoting,
  canSkipVoting,
  votingFinished,
  onStartGame,
  onStartRound,
  onStartReveals,
  onAdvanceTurn,
  onStartVoting,
  onSkipVoting,
  onEndGame
}: HostControlsProps) {
  if (!isHost) {
    return null;
  }

  // After voting resolved, the only useful host action is moving on.
  const primary = canStartGame
    ? { label: "O‘yinni boshlash", onClick: onStartGame }
    : canStartRound
      ? { label: "1-roundni boshlash", onClick: onStartRound }
      : canStartReveals
        ? { label: "Kartalarni ochishni boshlash", onClick: onStartReveals }
        : canAdvanceTurn
          ? { label: advanceTurnLabel, onClick: onAdvanceTurn }
          : votingFinished && canSkipVoting
            ? { label: "Keyingi roundni boshlash", onClick: onSkipVoting }
            : canStartVoting
              ? { label: "Ovoz berishni boshlash", onClick: onStartVoting }
              : null;

  // Secondary "skip voting" only makes sense before voting actually happened.
  const secondary =
    !votingFinished && canStartVoting && canSkipVoting
      ? { label: "Ovozsiz keyingi round", onClick: onSkipVoting }
      : null;

  const endLabel = isLobby ? "Roomni bekor qilish" : "O‘yinni tugatish";

  return (
    <div className="rounded-2xl border border-line-subtle bg-bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">Host paneli</p>
        {!isLobby ? (
          <button
            type="button"
            onClick={onEndGame}
            className="text-xs font-medium text-bad hover:underline"
          >
            O‘yinni tugatish
          </button>
        ) : null}
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
      ) : !isLobby ? (
        <p className="text-sm text-ink-muted">
          Hozir host uchun action yo‘q. Keyingi fazani kuting.
        </p>
      ) : null}

      {isLobby ? (
        <button
          type="button"
          onClick={onEndGame}
          className={`flex h-12 w-full items-center justify-center rounded-xl border border-bad/40 bg-bad/10 text-sm font-semibold text-bad transition active:scale-[0.98] ${primary || secondary ? "mt-2" : ""}`}
        >
          {endLabel}
        </button>
      ) : null}
    </div>
  );
}
