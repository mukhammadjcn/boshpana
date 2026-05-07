import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthToken: () => "token-1",
}));

vi.mock("@/lib/i18n", () => ({
  getStoredLanguage: () => "uz",
}));

import { apiRequest } from "./api";

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches status, code, and payload to thrown errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          code: "ACTIVE_ROOM_EXISTS",
          message: "Sizning aktiv o'yiningiz bor.",
          activeRoom: { code: "ROOM42" },
        }),
      })),
    );

    await expect(apiRequest("/api/rooms/matchmake", { method: "POST" })).rejects
      .toMatchObject({
        message: "Sizning aktiv o'yiningiz bor.",
        status: 409,
        code: "ACTIVE_ROOM_EXISTS",
        payload: {
          activeRoom: { code: "ROOM42" },
        },
      });
  });
});
