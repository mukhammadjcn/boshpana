import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OnlineChat } from "./online-chat";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, number>) =>
      key === "xabarlar_soni_count" ? `Messages: ${vars?.count ?? 0}` : key
  })
}));

describe("OnlineChat", () => {
  it("sends normalized text", () => {
    const onSend = vi.fn();

    render(<OnlineChat meId="me" messages={[]} onSend={onSend} />);

    fireEvent.click(screen.getByRole("button", { name: /chatni_ochish/i }));
    fireEvent.change(screen.getByPlaceholderText("chat_xabar_placeholder"), {
      target: { value: "  salom   jamoa  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "yuborish" }));

    expect(onSend).toHaveBeenCalledWith("salom jamoa");
  });
});
