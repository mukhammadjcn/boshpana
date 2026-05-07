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

  it("keeps friends rooms on the legacy experiences", () => {
    expect(
      resolveGameExperience({
        code: "IJKL",
        gameType: "BUNKER",
        status: "LOBBY",
        mode: "FRIENDS",
        visibility: "PRIVATE",
      }),
    ).toBe("bunker");

    expect(
      resolveGameExperience({
        code: "MNOP",
        gameType: "MAFIA",
        status: "PLAYING",
        mode: "FRIENDS",
        visibility: "PRIVATE",
      }),
    ).toBe("mafia");
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

  it("mounts the friends bunker experience for friends bunker rooms", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      code: "ROOM2",
      gameType: "BUNKER",
      status: "LOBBY",
      mode: "FRIENDS",
      visibility: "PRIVATE",
    });

    render(<GameRouter roomCode="ROOM2" view="room" />);

    await waitFor(() => {
      expect(screen.getByText("bunker")).toBeTruthy();
    });
  });

  it("mounts the friends mafia experience for friends mafia rooms", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      code: "ROOM3",
      gameType: "MAFIA",
      status: "PLAYING",
      mode: "FRIENDS",
      visibility: "PRIVATE",
    });

    render(<GameRouter roomCode="ROOM3" view="game" />);

    await waitFor(() => {
      expect(screen.getByText("mafia")).toBeTruthy();
    });
  });
});
