import { GameRouter } from "@/components/games/game-router";

export default async function RoomPage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <GameRouter roomCode={code.toUpperCase()} view="room" />;
}
