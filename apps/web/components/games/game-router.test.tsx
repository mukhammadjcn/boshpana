import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./bunker/bunker-experience", () => ({
  BunkerExperience: () => <div>bunker</div>,
}));

vi.mock("./mafia/mafia-experience", () => ({
  MafiaExperience: () => <div>mafia</div>,
}));

vi.mock("./online-bunker/online-bunker-experience", () => ({
  OnlineBunkerExperience: () => <div>online-bunker</div>,
}));

vi.mock("./online-mafia/online-mafia-experience", () => ({
  OnlineMafiaExperience: () => <div>online-mafia</div>,
}));

vi.mock("@/components/room-expired-state", () => ({
  RoomExpiredState: ({ detail }: { detail: string }) => <div>{detail}</div>,
}));

import { apiRequest } from "@/lib/api";

import { GameRouter, resolveGameExperience } from "./game-router";

describe("resolveGameExperience", () => {
  it("routes online rooms to dedicated experiences", () => {
    expect(
      resolveGameExperience({
        code: "ABCD",
        gameType: "BUNKER",
        status: "LOBBY",
        mode: "ONLINE",
        visibility: "PUBLIC",
      }),
    ).toBe("online-bunker");

    expect(
      resolveGameExperience({
        code: "EFGH",
        gameType: "MAFIA",
        status: "LOBBY",
        mode: "ONLINE",
        visibility: "PRIVATE",
      }),
    ).toBe("online-mafia");
  });
});

describe("GameRouter", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("mounts the online bunker experience for online bunker rooms", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      code: "ROOM1",
      gameType: "BUNKER",
      status: "LOBBY",
      mode: "ONLINE",
      visibility: "PUBLIC",
    });

    render(<GameRouter roomCode="ROOM1" view="room" />);

    await waitFor(() => {
      expect(screen.getByText("online-bunker")).toBeTruthy();
    });
  });
});
