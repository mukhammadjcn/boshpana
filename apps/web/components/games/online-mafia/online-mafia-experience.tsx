"use client";

import type { RoomVisibility } from "@/lib/types";

import { MafiaExperience } from "../mafia/mafia-experience";

type Props = {
  roomCode: string;
  view: "room" | "game";
  visibility: RoomVisibility;
};

export function OnlineMafiaExperience(props: Props) {
  return <MafiaExperience {...props} uiVariant="online" />;
}
