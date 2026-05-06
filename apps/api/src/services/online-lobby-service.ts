type ReadyPlayerLike = {
  readyAt: Date | string | null;
};

export function canEnableReady(playerCount: number, minPlayers: number): boolean {
  return playerCount >= minPlayers;
}

export function shouldAutoStartOnlineLobby(
  players: ReadyPlayerLike[],
  minPlayers: number
): boolean {
  return (
    canEnableReady(players.length, minPlayers) &&
    players.length > 0 &&
    players.every((player) => player.readyAt !== null)
  );
}
