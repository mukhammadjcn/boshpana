"use client";

import type { RoomVisibility } from "@/lib/types";

import { BunkerExperience } from "../bunker/bunker-experience";

type Props = {
  roomCode: string;
  view: "room" | "game";
  visibility: RoomVisibility;
};

export function OnlineBunkerExperience(props: Props) {
  return <BunkerExperience {...props} uiVariant="online" />;
}
