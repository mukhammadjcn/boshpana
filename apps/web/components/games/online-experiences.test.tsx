import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const bunkerSpy = vi.fn();
const mafiaSpy = vi.fn();

vi.mock("./bunker/bunker-experience", () => ({
  BunkerExperience: (props: unknown) => {
    bunkerSpy(props);
    return <div>bunker-proxy</div>;
  },
}));

vi.mock("./mafia/mafia-experience", () => ({
  MafiaExperience: (props: unknown) => {
    mafiaSpy(props);
    return <div>mafia-proxy</div>;
  },
}));

import { OnlineBunkerExperience } from "./online-bunker/online-bunker-experience";
import { OnlineMafiaExperience } from "./online-mafia/online-mafia-experience";

describe("online experience wrappers", () => {
  it("passes the online ui variant into bunker experience", () => {
    render(
      <OnlineBunkerExperience
        roomCode="ROOM1"
        view="room"
        visibility="PUBLIC"
      />,
    );

    expect(bunkerSpy).toHaveBeenCalledTimes(1);
    expect(bunkerSpy.mock.calls[0]?.[0]).toMatchObject({
        roomCode: "ROOM1",
        view: "room",
        visibility: "PUBLIC",
        uiVariant: "online",
    });
  });

  it("passes the online ui variant into mafia experience", () => {
    render(
      <OnlineMafiaExperience
        roomCode="ROOM2"
        view="game"
        visibility="PRIVATE"
      />,
    );

    expect(mafiaSpy).toHaveBeenCalledTimes(1);
    expect(mafiaSpy.mock.calls[0]?.[0]).toMatchObject({
        roomCode: "ROOM2",
        view: "game",
        visibility: "PRIVATE",
        uiVariant: "online",
    });
  });
});
