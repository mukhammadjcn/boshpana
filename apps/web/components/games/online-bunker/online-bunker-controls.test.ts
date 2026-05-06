import { describe, expect, it } from "vitest";

import { getOnlineBunkerDockConfig } from "./online-bunker-controls";

describe("getOnlineBunkerDockConfig", () => {
  it("requires at least three players before starting an online lobby", () => {
    expect(
      getOnlineBunkerDockConfig({
        isLobby: true,
        playersCount: 2,
        phase: "LOBBY",
        canStartReveals: false,
        canAdvanceTurn: false,
        advanceTurnLabelKey: "keyingi_oyinchi",
        canStartVoting: false,
        canSkipVoting: false,
        votingFinished: false,
      }).primary,
    ).toMatchObject({
      kind: "start_game",
      disabled: true,
      label: { key: "count_ta_oyinchi_kerak", vars: { count: 3 } },
    });
  });

  it("maps a resolved vote into the next-round creator action", () => {
    expect(
      getOnlineBunkerDockConfig({
        isLobby: false,
        playersCount: 6,
        phase: "ROUND_COMPLETE",
        canStartReveals: false,
        canAdvanceTurn: false,
        advanceTurnLabelKey: "keyingi_oyinchi",
        canStartVoting: false,
        canSkipVoting: true,
        votingFinished: true,
      }).primary,
    ).toMatchObject({
      kind: "skip_voting",
      label: { key: "keyingi_roundni_boshlash" },
    });
  });
});
