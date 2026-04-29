import { CardType } from "@prisma/client";
import { Server, Socket } from "socket.io";

import { GameService } from "../services/game-service";

type SocketActionPayload = {
  roomCode: string;
  sessionId: string;
};

export class RealtimeHub {
  constructor(
    private readonly io: Server,
    private readonly gameService: GameService
  ) {}

  register() {
    this.io.on("connection", (socket) => {
      socket.on("join_room", async (payload: SocketActionPayload) => {
        try {
          socket.data.roomCode = payload.roomCode.toUpperCase();
          socket.data.sessionId = payload.sessionId;
          await socket.join(socket.data.roomCode);
          await this.broadcastRoomState(socket.data.roomCode);
        } catch (error) {
          socket.emit("action_error", { message: (error as Error).message });
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
        async (payload: SocketActionPayload & { cardType: CardType }) => {
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
    const socketIds = await this.io.in(roomCode.toUpperCase()).allSockets();

    for (const socketId of socketIds) {
      const socket = this.io.sockets.sockets.get(socketId);
      const sessionId = socket?.data.sessionId as string | undefined;

      if (!socket || !sessionId) {
        continue;
      }

      try {
        const state = await this.gameService.getRoomState(roomCode, sessionId);
        socket.emit("room_state", state);
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
}
