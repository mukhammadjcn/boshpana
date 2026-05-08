import assert from "node:assert/strict";
import test from "node:test";

import { chatService } from "./chat-service";

test("chat message text is normalized", () => {
  const message = chatService.createMessage({
    senderId: "player-1",
    senderName: "Ali",
    text: "  salom   dunyo  "
  });

  assert.equal(message.senderId, "player-1");
  assert.equal(message.senderName, "Ali");
  assert.equal(message.text, "salom   dunyo");
  assert.ok(message.id.length > 0);
  assert.ok(Date.parse(message.timestamp) > 0);
});
