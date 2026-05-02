import { BunkerCardType } from "@prisma/client";
import { Server, Socket } from "socket.io";

import { GameRegistry } from "../games/registry";

type SocketActionPayload = {
  roomCode: string;
  sessionId: string;
};

export class RealtimeHub {
  // Presence tracking: which player sessions currently have a live socket
  // attached to which room. Used by `isSessionOnline` so room-state
  // broadcasts can surface lobby online/offline dots. Maintained here
  // (single source of truth) rather than in game-service.
  private readonly onlineByRoom = new Map<string, Set<string>>();

  constructor(
    private readonly io: Server,
    private readonly games: GameRegistry
  ) {}

  // Game-specific actions (reveal_card, vote, etc.) currently route to the
  // Bunker module — that's the only registered game. When Mafia is added,
  // each handler should look up the room's gameType and dispatch via
  // `this.games.for(gameType)` instead.
  private get gameService() {
    return this.games.bunker;
  }

  isSessionOnline(roomCode: string, sessionId: string): boolean {
    return (
      this.onlineByRoom.get(roomCode.toUpperCase())?.has(sessionId) ?? false
    );
  }

  register() {
    this.io.on("connection", (socket) => {
      socket.on("join_room", async (payload: SocketActionPayload) => {
        try {
          socket.data.roomCode = payload.roomCode.toUpperCase();
          socket.data.sessionId = payload.sessionId;
          await socket.join(socket.data.roomCode);
          this.markOnline(socket.data.roomCode, socket.data.sessionId);
          await this.broadcastRoomState(socket.data.roomCode);
        } catch (error) {
          socket.emit("action_error", { message: (error as Error).message });
        }
      });

      socket.on("disconnect", async () => {
        const roomCode = socket.data.roomCode as string | undefined;
        const sessionId = socket.data.sessionId as string | undefined;
        if (!roomCode || !sessionId) return;
        // Other tabs / devices for the same session may still be connected
        // — only flip to offline when no socket for this sessionId remains
        // in the room.
        const stillConnected = await this.hasOtherSocketForSession(
          roomCode,
          sessionId,
          socket.id
        );
        if (!stillConnected) {
          this.markOffline(roomCode, sessionId);
          await this.broadcastRoomState(roomCode);
        }
      });

      socket.on("start_game", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          await this.gameService.startGame({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on("start_round", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          await this.gameService.startRound({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on("start_reveals", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          await this.gameService.startRoundReveals({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on(
        "reveal_card",
        async (payload: SocketActionPayload & { cardType: BunkerCardType }) => {
          await this.handleAction(socket, async () => {
            await this.gameService.revealCard({
              code: payload.roomCode,
              sessionId: payload.sessionId,
              cardType: payload.cardType
            });
            await this.broadcastRoomState(payload.roomCode);
          });
        }
      );

      socket.on(
        "vote",
        async (payload: SocketActionPayload & { targetPlayerId: string }) => {
          await this.handleAction(socket, async () => {
            await this.gameService.submitVote({
              code: payload.roomCode,
              sessionId: payload.sessionId,
              targetPlayerId: payload.targetPlayerId
            });
            await this.broadcastRoomState(payload.roomCode);
          });
        }
      );

      socket.on("advance_turn", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          await this.gameService.advanceTurn({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on("start_voting", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          await this.gameService.startVoting({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on("skip_voting", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          await this.gameService.skipVoting({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on("end_game", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          await this.gameService.endGame({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on(
        "kick_player",
        async (payload: SocketActionPayload & { targetPlayerId: string }) => {
          await this.handleAction(socket, async () => {
            await this.gameService.kickPlayer({
              code: payload.roomCode,
              sessionId: payload.sessionId,
              targetPlayerId: payload.targetPlayerId
            });
            await this.broadcastRoomState(payload.roomCode);
          });
        }
      );

      socket.on("leave_room", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          await this.gameService.leaveRoom({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on("next_phase", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          await this.gameService.nextPhase({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });
    });
  }

  async broadcastRoomState(roomCode: string) {
    const code = roomCode.toUpperCase();
    const socketIds = await this.io.in(code).allSockets();
    if (socketIds.size === 0) return;

    // Fetch the room ONCE and derive per-session state in memory. Without
    // this, large lobbies hit the DB N times for what is effectively the
    // same query — measurable lag during phase transitions.
    let prepared: Awaited<
      ReturnType<typeof this.gameService.getRoomStateForBroadcast>
    >;
    try {
      prepared = await this.gameService.getRoomStateForBroadcast(code);
    } catch (error) {
      const message = (error as Error).message;
      for (const socketId of socketIds) {
        const socket = this.io.sockets.sockets.get(socketId);
        socket?.emit("action_error", { message });
      }
      return;
    }

    for (const socketId of socketIds) {
      const socket = this.io.sockets.sockets.get(socketId);
      const sessionId = socket?.data.sessionId as string | undefined;
      if (!socket || !sessionId) continue;
      try {
        socket.emit("room_state", prepared.perSession(sessionId));
      } catch (error) {
        socket.emit("action_error", { message: (error as Error).message });
      }
    }
  }

  broadcastTimer(roomCode: string, remainingSeconds: number) {
    this.io.to(roomCode.toUpperCase()).emit("timer_update", { remainingSeconds });
  }

  private async handleAction(socket: Socket, action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      socket.emit("action_error", { message: (error as Error).message });
    }
  }

  private markOnline(roomCode: string, sessionId: string) {
    let bucket = this.onlineByRoom.get(roomCode);
    if (!bucket) {
      bucket = new Set();
      this.onlineByRoom.set(roomCode, bucket);
    }
    bucket.add(sessionId);
  }

  private markOffline(roomCode: string, sessionId: string) {
    const bucket = this.onlineByRoom.get(roomCode);
    if (!bucket) return;
    bucket.delete(sessionId);
    if (bucket.size === 0) {
      this.onlineByRoom.delete(roomCode);
    }
  }

  // True when any socket OTHER than `excludeSocketId` (the one currently
  // disconnecting) is still attached to the room with the same sessionId.
  // Lets us keep the user "online" while their second tab/device remains.
  private async hasOtherSocketForSession(
    roomCode: string,
    sessionId: string,
    excludeSocketId: string
  ): Promise<boolean> {
    const socketIds = await this.io.in(roomCode).allSockets();
    for (const id of socketIds) {
      if (id === excludeSocketId) continue;
      const s = this.io.sockets.sockets.get(id);
      if (s?.data.sessionId === sessionId) return true;
    }
    return false;
  }
}
