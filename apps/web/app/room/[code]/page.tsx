import { RoomExperience } from "@/components/room-experience";

export default async function RoomPage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <RoomExperience roomCode={code.toUpperCase()} view="room" />;
}
