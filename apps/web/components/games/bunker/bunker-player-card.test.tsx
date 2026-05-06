import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

import { PlayerCard } from "./bunker-player-card";

describe("PlayerCard", () => {
  it("shows the ready badge in online lobby tiles", () => {
    render(
      <PlayerCard
        name="Alisher"
        isHost={false}
        isAlive
        isReady
        online
        showPresence
        revealedCards={{}}
        variant="tile"
      />,
    );

    expect(screen.getByText("tayyor")).toBeTruthy();
    expect(screen.getByText("onlayn")).toBeTruthy();
  });
});
