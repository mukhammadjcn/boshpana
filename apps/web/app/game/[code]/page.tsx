import { GameRouter } from "@/components/games/game-router";

export default async function GamePage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <GameRouter roomCode={code.toUpperCase()} view="game" />;
}
