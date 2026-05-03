import { GameRouter } from "@/components/games/game-router";

export const metadata = {
  robots: { index: false, follow: false }
};

export default async function GamePage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <GameRouter roomCode={code.toUpperCase()} view="game" />;
}
