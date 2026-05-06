"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", {
      autoConnect: false,
      // Prefer WebSocket, but keep polling available as a fallback so
      // mobile webviews can recover after flaky network transitions.
      transports: ["websocket", "polling"],
      // Auto-reconnect on involuntary disconnects (network drop, server
      // restart). We pin the delay to a fixed 2s with no jitter and no
      // attempt cap, so a user who briefly loses Wi-Fi reconnects within
      // ~2s of the network coming back. The reconnect loop stops on its
      // own once the socket fires `connect` again.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 2000,
      randomizationFactor: 0
    });
  }

  return socket;
}
