import { describe, expect, it } from "vitest";

import {
  buildMatchmakeBody,
  buildOnlineCreateRoomBody,
  parseActiveRoomConflict,
} from "./online-room-utils";

describe("online room helpers", () => {
  it("builds online create payloads with mode and options", () => {
    expect(
      buildOnlineCreateRoomBody({
        gameType: "BUNKER",
        hostName: "  Alisher  ",
        sessionId: "session-1",
        visibility: "PRIVATE",
        confirmLeaveExisting: true,
        options: { winnerTarget: 3, isAdult: true },
      }),
    ).toEqual({
      gameType: "BUNKER",
      hostName: "Alisher",
      sessionId: "session-1",
      mode: "ONLINE",
      visibility: "PRIVATE",
      confirmLeaveExisting: true,
      winnerTarget: 3,
      isAdult: true,
    });
  });

  it("builds public matchmake payloads without optional flags by default", () => {
    expect(
      buildMatchmakeBody({
        gameType: "MAFIA",
        hostName: " Nodir ",
        sessionId: "session-2",
      }),
    ).toEqual({
      gameType: "MAFIA",
      hostName: "Nodir",
      sessionId: "session-2",
    });
  });

  it("extracts ACTIVE_ROOM_EXISTS payloads from api errors", () => {
    const error = Object.assign(new Error("Sizning aktiv o'yiningiz bor."), {
      status: 409,
      code: "ACTIVE_ROOM_EXISTS",
      payload: {
        code: "ACTIVE_ROOM_EXISTS",
        message: "Sizning aktiv o'yiningiz bor.",
        activeRoom: {
          code: "ROOM42",
          gameType: "BUNKER",
          status: "LOBBY",
          mode: "ONLINE",
          visibility: "PUBLIC",
        },
      },
    });

    expect(parseActiveRoomConflict(error)).toEqual(error.payload);
  });
});
