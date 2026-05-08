"use client";

import { useState } from "react";

import type { CreateTabMode } from "./create-page-tabs";

// Plain in-memory tab state. Default is "online" — most users land on the
// create page to start an online game, so we open that tab first. Reload
// resets the tab; if a deeper persistence story is wanted later, swap the
// useState for a storage- or URL-backed implementation.
export function useCreateTabMode(): [
  CreateTabMode,
  (next: CreateTabMode) => void,
] {
  return useState<CreateTabMode>("online");
}
