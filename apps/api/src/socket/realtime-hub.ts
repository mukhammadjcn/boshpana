import { BunkerCardType, MafiaNightActionType } from "@prisma/client";
import { Server, Socket } from "socket.io";

import { GameRegistry } from "../games/registry";
import { prisma } from "../lib/prisma";
import { chatService } from "../services/chat-service";
import { hostTransferService } from "../services/host-transfer-service";
import {
  OnlineGovernanceActionService,
  type CreatorChangedPayload,
  type OnlineGovernanceActionResult
} from "../services/online-governance-action-service";

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

  // Pending "go offline" timers, keyed by `${roomCode}:${sessionId}`.
  // We don't flip a session offline the instant its socket dies — the
  // client reconnects every 2s, so a brief network blip would otherwise
  // produce a confusing online → offline → online flicker for everyone in
  // the lobby. Instead we wait OFFLINE_GRACE_MS; if the same session
  // re-attaches a new socket within the window, the timer is cancelled.
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();
  private static readonly OFFLINE_GRACE_MS = 3000;
  private readonly hostTransferTimers = new Map<string, NodeJS.Timeout>();
  private static readonly HOST_TRANSFER_GRACE_MS = 300_000; // 5 minutes

  constructor(
    private readonly io: Server,
    private readonly games: GameRegistry
  ) {
    this.onlineGovernanceActions = new OnlineGovernanceActionService(games);
  }

  private readonly onlineGovernanceActions: OnlineGovernanceActionService;

  // Bunker-specific shortcut. Bunker has the richer per-phase action
  // surface (reveal_card, advance_turn, etc.) that doesn't apply to
  // Mafia, so those handlers keep calling Bunker directly. Shared
  // lobby actions (start_game, leave_room, kick_player, end_game) and
  // every state broadcast go through `serviceForRoom` instead so they
  // dispatch to the right per-game module by gameType.
  private get gameService() {
    return this.games.bunker;
  }

  private async serviceForRoom(roomCode: string) {
    const room = await prisma.room.findUnique({
      where: { code: roomCode.toUpperCase() },
      select: { gameType: true }
    });
    if (!room) return null;
    return this.games.for(room.gameType);
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
          const nextRoomCode = payload.roomCode.toUpperCase();
          const previousRoomCode = socket.data.roomCode as string | undefined;
          const previousSessionId = socket.data.sessionId as string | undefined;

          // A single socket can navigate between rooms without reconnecting.
          // Leave the previous Socket.IO room first so later broadcasts from
          // the old game cannot overwrite the new screen on the client.
          if (
            previousRoomCode &&
            previousSessionId &&
            previousRoomCode !== nextRoomCode
          ) {
            await socket.leave(previousRoomCode);
            const stillConnected = await this.hasOtherSocketForSession(
              previousRoomCode,
              previousSessionId,
              socket.id
            );
            if (!stillConnected) {
              this.scheduleOfflineTransition(
                previousRoomCode,
                previousSessionId,
                socket.id
              );
              this.scheduleHostTransfer(
                previousRoomCode,
                previousSessionId,
                socket.id
              );
            }
          }

          socket.data.roomCode = nextRoomCode;
          socket.data.sessionId = payload.sessionId;
          await socket.join(socket.data.roomCode);
          // Cancel any in-flight offline timer for this session — the
          // client just (re)attached, so the previous disconnect was a
          // transient blip we shouldn't surface to other players.
          this.cancelOfflineTimer(
            socket.data.roomCode,
            socket.data.sessionId
          );
          this.cancelHostTransferTimer(
            socket.data.roomCode,
            socket.data.sessionId
          );
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
        if (stillConnected) return;
        // Defer the offline transition so a quick reconnect (the client
        // retries every 2s) doesn't trigger a visible online → offline →
        // online flicker for everyone watching the lobby.
        this.scheduleOfflineTransition(roomCode, sessionId, socket.id);
        this.scheduleHostTransfer(roomCode, sessionId, socket.id);
      });

      socket.on("start_game", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          const service = await this.serviceForRoom(payload.roomCode);
          if (!service) throw new Error("Room topilmadi.");
          await service.startGame({
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
        async (
          payload: SocketActionPayload & {
            targetPlayerId?: string;
            targetPlayerIds?: string[];
          }
        ) => {
          await this.handleAction(socket, async () => {
            // Friends clients still send a single `targetPlayerId`; online
            // multi-elim rounds send `targetPlayerIds`. Normalise both into
            // the array shape the service expects.
            const targetPlayerIds = payload.targetPlayerIds
              ? payload.targetPlayerIds
              : payload.targetPlayerId
                ? [payload.targetPlayerId]
                : [];
            await this.gameService.submitVote({
              code: payload.roomCode,
              sessionId: payload.sessionId,
              targetPlayerIds
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

      socket.on(
        "play_action_card",
        async (
          payload: SocketActionPayload & {
            instanceId: string;
            targetPlayerId?: string;
          }
        ) => {
          await this.handleAction(socket, async () => {
            const result = await this.gameService.playActionCard({
              code: payload.roomCode,
              sessionId: payload.sessionId,
              instanceId: payload.instanceId,
              targetPlayerId: payload.targetPlayerId
            });
            // Xonadagi barchaga "kim qaysi karta ishlatdi" toast eventi.
            // Faza o'zgarmaydi; bu shunchaki ko'rsatish uchun.
            this.io.to(payload.roomCode.toUpperCase()).emit("action_played", {
              sourcePlayerId: result.sourcePlayerId,
              sourcePlayerName: result.sourcePlayerName,
              cardKey: result.cardKey,
              titleUz: result.titleUz,
              titleRu: result.titleRu,
              titleEn: result.titleEn,
              descriptionUz: result.descriptionUz,
              descriptionRu: result.descriptionRu,
              descriptionEn: result.descriptionEn,
              targetPlayerId: result.targetPlayerId,
              targetPlayerName: result.targetPlayerName,
              effect: result.effect,
              resultMeta: result.resultMeta
            });
            await this.broadcastRoomState(payload.roomCode);
          });
        }
      );

      socket.on("start_voting", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          const result = await this.gameService.startVoting({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          // Maxsus karta sababli hamma immune bo'lsa, voting o'tkazib yuborildi —
          // xonadagi barchaga sodda system toast.
          if (result?.skippedAllImmune) {
            this.io.to(payload.roomCode.toUpperCase()).emit("action_played", {
              sourcePlayerId: "system",
              sourcePlayerName: "System",
              cardKey: "system_all_immune",
              titleUz: "Barcha daxlsiz — raund o'tkazildi",
              titleRu: "Все защищены — раунд пропущен",
              titleEn: "Everyone immune — round skipped",
              descriptionUz: "Hech kim haydalmadi, keyingi raundga o'tamiz.",
              descriptionRu: "Никто не исключён, переходим к следующему раунду.",
              descriptionEn: "No one was eliminated, moving to the next round.",
              targetPlayerId: null,
              targetPlayerName: null,
              effect: "ALL_IMMUNE_SKIP",
              resultMeta: null
            });
          }
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
          const service = await this.serviceForRoom(payload.roomCode);
          if (!service) throw new Error("Room topilmadi.");
          await service.endGame({
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
            const service = await this.serviceForRoom(payload.roomCode);
            if (!service) throw new Error("Room topilmadi.");
            await service.kickPlayer({
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
          const service = await this.serviceForRoom(payload.roomCode);
          if (!service) throw new Error("Room topilmadi.");
          const result = await service.leaveRoom({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          const creatorChanged = this.extractCreatorChangedPayload(result);
          if (creatorChanged) {
            this.emitCreatorChanged(creatorChanged);
          }
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on("toggle_ready", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          const service = await this.serviceForRoom(payload.roomCode);
          if (!service || !("toggleReady" in service)) {
            throw new Error("Bu xona tayyor holatini qo'llamaydi.");
          }
          await service.toggleReady({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      socket.on(
        "chat:send",
        async (payload: SocketActionPayload & { text: string }) => {
          await this.handleAction(socket, async () => {
            const service = await this.serviceForRoom(payload.roomCode);
            if (!service) throw new Error("Room topilmadi.");

            const prepared = await service.getRoomStateForBroadcast(
              payload.roomCode.toUpperCase()
            );
            const state = prepared.perSession(payload.sessionId) as {
              room: { status: string };
              me: { id: string; name: string; isAlive?: boolean } | null;
            };
            if (!state.me) {
              throw new Error("Chatga yozish uchun avval roomga kiring.");
            }

            const text = payload.text.trim();
            if (!text) {
              throw new Error("Xabar bo'sh bo'lishi mumkin emas.");
            }
            if (text.length > 300) {
              throw new Error("Xabar 300 ta belgidan oshmasligi kerak.");
            }

            // Mafia: a player eliminated mid-game is silenced — except
            // for one final "last words" message. Once they've spent it
            // they can no longer write. Alive players, the lobby and the
            // post-game (FINISHED) review chat are all unrestricted.
            const isMafia = service === this.games.mafia;
            const isDeadInPlay =
              isMafia &&
              state.me.isAlive === false &&
              state.room.status === "PLAYING";
            let kind: "last_words" | undefined;
            if (isDeadInPlay) {
              const claimed = await chatService.claimLastWords(
                payload.roomCode,
                state.me.id
              );
              if (!claimed) {
                throw new Error(
                  "Siz so'nggi so'zingizni allaqachon yozdingiz. Endi chatga yoza olmaysiz."
                );
              }
              kind = "last_words";
            }

            const message = chatService.createMessage({
              senderId: state.me.id,
              senderName: state.me.name,
              text,
              kind
            });
            await chatService.appendMessage(payload.roomCode, message);
            await this.broadcastRoomState(payload.roomCode);
          });
        }
      );

      // Ephemeral "X is typing" ping. Deliberately NOT routed through
      // handleAction / room-state: it's a fire-and-forget UI hint that
      // we relay to everyone else in the room and never persist. The
      // client already throttles these to ~1 every 1.5s.
      socket.on(
        "chat:typing",
        (payload: SocketActionPayload & { playerId?: string; name?: string }) => {
          const roomCode = socket.data.roomCode as string | undefined;
          if (!roomCode) return;
          const playerId =
            typeof payload?.playerId === "string" ? payload.playerId : null;
          const name =
            typeof payload?.name === "string"
              ? payload.name.trim().slice(0, 40)
              : null;
          if (!playerId || !name) return;
          socket.to(roomCode).emit("chat:typing", { playerId, name });
        }
      );

      socket.on("online:request_end_game_vote", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          const result = await this.onlineGovernanceActions.requestEndGameVote({
            roomCode: payload.roomCode,
            sessionId: payload.sessionId
          });
          this.emitCreatorChangedFromResult(result);
          await this.broadcastRoomState(result.roomCode);
        });
      });

      socket.on(
        "online:vote_end_game",
        async (
          payload: SocketActionPayload & {
            proposalId: string;
            approve: boolean;
          }
        ) => {
          await this.handleAction(socket, async () => {
            const result = await this.onlineGovernanceActions.voteEndGame({
              roomCode: payload.roomCode,
              sessionId: payload.sessionId,
              proposalId: payload.proposalId,
              approve: payload.approve
            });
            this.emitCreatorChangedFromResult(result);
            await this.broadcastRoomState(result.roomCode);
          });
        }
      );

      socket.on(
        "online:request_kick_vote",
        async (
          payload: SocketActionPayload & {
            targetPlayerId: string;
          }
        ) => {
          await this.handleAction(socket, async () => {
            const result = await this.onlineGovernanceActions.requestKickVote({
              roomCode: payload.roomCode,
              sessionId: payload.sessionId,
              targetPlayerId: payload.targetPlayerId,
            });
            this.emitCreatorChangedFromResult(result);
            await this.broadcastRoomState(result.roomCode);
          });
        }
      );

      socket.on(
        "online:vote_kick",
        async (
          payload: SocketActionPayload & {
            proposalId: string;
            approve: boolean;
          }
        ) => {
          await this.handleAction(socket, async () => {
            const result = await this.onlineGovernanceActions.voteKick({
              roomCode: payload.roomCode,
              sessionId: payload.sessionId,
              proposalId: payload.proposalId,
              approve: payload.approve
            });
            this.emitCreatorChangedFromResult(result);
            await this.broadcastRoomState(result.roomCode);
          });
        }
      );

      socket.on("online:request_skip_to_vote", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          const result = await this.onlineGovernanceActions.requestSkipToVote({
            roomCode: payload.roomCode,
            sessionId: payload.sessionId
          });
          this.emitCreatorChangedFromResult(result);
          await this.broadcastRoomState(result.roomCode);
        });
      });

      socket.on(
        "online:vote_skip_to_vote",
        async (
          payload: SocketActionPayload & {
            proposalId: string;
            approve: boolean;
          }
        ) => {
          await this.handleAction(socket, async () => {
            const result = await this.onlineGovernanceActions.voteSkipToVote({
              roomCode: payload.roomCode,
              sessionId: payload.sessionId,
              proposalId: payload.proposalId,
              approve: payload.approve
            });
            this.emitCreatorChangedFromResult(result);
            await this.broadcastRoomState(result.roomCode);
          });
        }
      );

      // ── Mafia-spetsifik eventlar ─────────────────────────────────
      // Player taps "Tasdiqlash" on the role-reveal screen. We forward
      // straight to the Mafia service; the room is guaranteed to be a
      // Mafia room (Bunker frontend never emits this event), but we
      // route via `serviceForRoom` to keep dispatch consistent.
      socket.on("mafia:confirm_role", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          const service = await this.serviceForRoom(payload.roomCode);
          if (!service || !("confirmRole" in service)) {
            throw new Error("Bu xona Mafia o'yini emas.");
          }
          await service.confirmRole({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      // Player chooses (or re-chooses) their night target. Mafia,
      // sheriff, doctor and citizen all flow through this single event;
      // the service validates the action ↔ role pairing.
      socket.on(
        "mafia:submit_night_action",
        async (
          payload: SocketActionPayload & {
            action: MafiaNightActionType;
            targetPlayerId: string | null;
          }
        ) => {
          await this.handleAction(socket, async () => {
            const service = await this.serviceForRoom(payload.roomCode);
            if (!service || !("submitNightAction" in service)) {
              throw new Error("Bu xona Mafia o'yini emas.");
            }
            await service.submitNightAction({
              code: payload.roomCode,
              sessionId: payload.sessionId,
              action: payload.action,
              targetPlayerId: payload.targetPlayerId
            });
            await this.broadcastRoomState(payload.roomCode);
          });
        }
      );

      socket.on("mafia:confirm_night_action", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          const service = await this.serviceForRoom(payload.roomCode);
          if (!service || !("confirmNightAction" in service)) {
            throw new Error("Bu xona Mafia o'yini emas.");
          }
          await service.confirmNightAction({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      // Day vote (and tiebreak re-vote). The service handles auto-
      // resolution once every alive player has submitted, so the
      // client just needs to fire-and-forget here.
      socket.on(
        "mafia:submit_day_vote",
        async (
          payload: SocketActionPayload & { targetPlayerId: string }
        ) => {
          await this.handleAction(socket, async () => {
            const service = await this.serviceForRoom(payload.roomCode);
            if (!service || !("submitDayVote" in service)) {
              throw new Error("Bu xona Mafia o'yini emas.");
            }
            await service.submitDayVote({
              code: payload.roomCode,
              sessionId: payload.sessionId,
              targetPlayerId: payload.targetPlayerId
            });
            await this.broadcastRoomState(payload.roomCode);
          });
        }
      );

      socket.on("mafia:confirm_day_vote", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          const service = await this.serviceForRoom(payload.roomCode);
          if (!service || !("confirmDayVote" in service)) {
            throw new Error("Bu xona Mafia o'yini emas.");
          }
          await service.confirmDayVote({
            code: payload.roomCode,
            sessionId: payload.sessionId
          });
          await this.broadcastRoomState(payload.roomCode);
        });
      });

      // Host short-circuit: skip discussion to vote, or force-resolve
      // a vote round before the timer expires.
      socket.on("mafia:advance_phase", async (payload: SocketActionPayload) => {
        await this.handleAction(socket, async () => {
          const service = await this.serviceForRoom(payload.roomCode);
          if (!service || !("advancePhase" in service)) {
            throw new Error("Bu xona Mafia o'yini emas.");
          }
          await service.advancePhase({
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

    // Pick the per-game service for this room first so the broadcast
    // shape matches what the right frontend expects.
    const service = await this.serviceForRoom(code);
    if (!service) return;

    // Fetch the room ONCE and derive per-session state in memory. Without
    // this, large lobbies hit the DB N times for what is effectively the
    // same query — measurable lag during phase transitions.
    let prepared: { perSession: (sessionId: string) => unknown };
    try {
      prepared = await service.getRoomStateForBroadcast(code);
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

  private offlineTimerKey(roomCode: string, sessionId: string): string {
    return `${roomCode}:${sessionId}`;
  }

  // After a socket disconnects, hold off on flipping the session offline
  // for OFFLINE_GRACE_MS. If the client reconnects within that window,
  // join_room cancels the pending timer and nobody sees a flicker. If
  // the timer fires, we re-check that the session is still gone (in case
  // a sibling socket attached after we scheduled), then mark it offline
  // and broadcast the lobby state.
  private scheduleOfflineTransition(
    roomCode: string,
    sessionId: string,
    excludeSocketId: string
  ) {
    const key = this.offlineTimerKey(roomCode, sessionId);
    // Replace any existing timer for this session — the most recent
    // disconnect is the one whose grace window we want to honour.
    const existing = this.offlineTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.offlineTimers.delete(key);
      // The exclude id no longer matters once the grace window has
      // elapsed (that socket is long gone), but passing it keeps the
      // check defensive against any lingering reference.
      const stillConnected = await this.hasOtherSocketForSession(
        roomCode,
        sessionId,
        excludeSocketId
      );
      if (stillConnected) return;
      this.markOffline(roomCode, sessionId);
      await this.broadcastRoomState(roomCode);
    }, RealtimeHub.OFFLINE_GRACE_MS);

    this.offlineTimers.set(key, timer);
  }

  private cancelOfflineTimer(roomCode: string, sessionId: string) {
    const key = this.offlineTimerKey(roomCode, sessionId);
    const timer = this.offlineTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.offlineTimers.delete(key);
    }
  }

  private scheduleHostTransfer(
    roomCode: string,
    sessionId: string,
    excludeSocketId: string
  ) {
    const key = this.offlineTimerKey(roomCode, sessionId);
    const existing = this.hostTransferTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.hostTransferTimers.delete(key);
      const stillConnected = await this.hasOtherSocketForSession(
        roomCode,
        sessionId,
        excludeSocketId
      );
      if (stillConnected) return;

      const transfer = await hostTransferService.transferOnlineRoomHost({
        roomCode,
        expectedHostSessionId: sessionId
      });

      if (!transfer) {
        return;
      }

      if (transfer.kind === "no_successor") {
        const service = await this.serviceForRoom(transfer.roomCode);
        await service?.endGame({
          code: transfer.roomCode,
          sessionId: transfer.previousHostSessionId
        });
        await this.broadcastRoomState(transfer.roomCode);
        return;
      }

      if (transfer.kind !== "transferred") {
        return;
      }

      this.emitCreatorChanged({
        roomCode: transfer.roomCode,
        previousHostSessionId: transfer.previousHostSessionId,
        nextHostSessionId: transfer.nextHostSessionId,
        nextHostPlayerId: transfer.nextHostPlayerId
      });
      await this.broadcastRoomState(roomCode);
    }, RealtimeHub.HOST_TRANSFER_GRACE_MS);

    this.hostTransferTimers.set(key, timer);
  }

  private cancelHostTransferTimer(roomCode: string, sessionId: string) {
    const key = this.offlineTimerKey(roomCode, sessionId);
    const timer = this.hostTransferTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.hostTransferTimers.delete(key);
    }
  }

  private emitCreatorChanged(payload: CreatorChangedPayload) {
    this.io.to(payload.roomCode.toUpperCase()).emit("creator_changed", payload);
  }

  private emitCreatorChangedFromResult(result: OnlineGovernanceActionResult) {
    if (result.creatorChanged) {
      this.emitCreatorChanged(result.creatorChanged);
    }
  }

  private extractCreatorChangedPayload(value: unknown): CreatorChangedPayload | null {
    if (!value || typeof value !== "object" || !("creatorChanged" in value)) {
      return null;
    }
    const payload = (value as { creatorChanged?: CreatorChangedPayload | null }).creatorChanged;
    return payload ?? null;
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
