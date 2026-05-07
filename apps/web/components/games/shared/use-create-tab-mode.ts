"use client";

import { useEffect, useState } from "react";

import type { CreateTabMode } from "./create-page-tabs";

const STORAGE_KEY = "create_tab_mode";

function readInitial(): CreateTabMode {
  if (typeof window === "undefined") return "friends";
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get("mode");
  if (fromQuery === "online" || fromQuery === "friends") return fromQuery;
  const fromStorage = window.sessionStorage.getItem(STORAGE_KEY);
  if (fromStorage === "online" || fromStorage === "friends") return fromStorage;
  return "friends";
}

// Client-side only tab state. Persists the active tab in sessionStorage so
// reload keeps the user on the same view, and reflects it in the URL
// (?mode=online) for shareable / deep-linkable navigation. Avoids
// useSearchParams to skip the Suspense boundary requirement on Next 15.
export function useCreateTabMode(): [
  CreateTabMode,
  (next: CreateTabMode) => void,
] {
  const [mode, setMode] = useState<CreateTabMode>("friends");

  useEffect(() => {
    setMode(readInitial());
  }, []);

  function update(next: CreateTabMode) {
    setMode(next);
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_KEY, next);
    const url = new URL(window.location.href);
    if (next === "friends") {
      url.searchParams.delete("mode");
    } else {
      url.searchParams.set("mode", next);
    }
    window.history.replaceState(null, "", url.toString());
  }

  return [mode, update];
}
