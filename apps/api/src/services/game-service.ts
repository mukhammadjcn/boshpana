import {
  CardType,
  GameOutcome,
  GamePhase,
  Prisma,
  RoomStatus
} from "@prisma/client";
import { randomBytes, randomInt } from "node:crypto";

import { prisma } from "../lib/prisma";
import { CARD_TYPES, PublicRoomState } from "../types/game";

type RealtimePublisher = {
  broadcastRoomState: (roomCode: string) => Promise<void>;
  broadcastTimer: (roomCode: string, remainingSeconds: number) => void;
  // Whether a given player session currently has a live socket attached
  // to the room. Used to render lobby presence — players who joined but
  // disconnected/closed their tab show as offline so the host can decide
  // whether to wait or kick. Returns true when unknown so we never lie
  // about a player being offline.
  isSessionOnline?: (roomCode: string, sessionId: string) => boolean;
};

type CreateRoomInput = {
  hostName: string;
  sessionId: string;
  winnerTarget: number;
  maxPlayers?: number;
  hostUserId?: string;
  isAdult?: boolean;
};

type JoinRoomInput = {
  code: string;
  name: string;
  sessionId: string;
  userId?: string;
};

type RoomCodeAction = {
  code: string;
  sessionId: string;
};

type RevealInput = RoomCodeAction & {
  cardType: CardType;
};

type VoteInput = RoomCodeAction & {
  targetPlayerId: string;
};

type RoomWithState = Prisma.RoomGetPayload<{
  include: {
    players: {
      include: {
        attributes: true;
      };
      orderBy: {
        seatOrder: "asc";
      };
    };
    game: {
      include: {
        disaster: true;
        currentSituation: true;
      };
    };
    votes: true;
  };
}>;

const noopRealtime: RealtimePublisher = {
  broadcastRoomState: async () => undefined,
  broadcastTimer: () => undefined,
  isSessionOnline: () => true
};

export class GameService {
  private realtime: RealtimePublisher = noopRealtime;

  private readonly timers = new Map<string, NodeJS.Timeout>();

  private cleanupTimer: NodeJS.Timeout | null = null;

  setRealtime(publisher: RealtimePublisher) {
    this.realtime = publisher;
  }

  // Periodic janitor:
  //   1. Auto-cancel rooms that the host abandoned:
  //        - LOBBY older than lobbyTimeoutMs (default 2h): the host
  //          created the room but the game never started. Doesn't count
  //          toward the monthly limit.
  //        - PLAYING older than playingTimeoutMs (default 24h): the game
  //          started but stalled. Counts as cancelled in history.
  //   2. Delete FINISHED/CANCELLED rooms older than ageMs so the DB
  //      doesn't grow unbounded. History rows survive (separate table).
  startCleanupSweeper(
    intervalMs = 10 * 60 * 1000,
    // Keep finished rooms for 2 hours so per-user card history survives a
    // few back-to-back games and the dealer can de-duplicate against it.
    ageMs = 2 * 60 * 60 * 1000,
    lobbyTimeoutMs = 2 * 60 * 60 * 1000,
    playingTimeoutMs = 24 * 60 * 60 * 1000
  ) {
    if (this.cleanupTimer) return;
    const sweep = async () => {
      try {
        // Step 1: cancel stale rooms.
        const now = Date.now();
        const lobbyCutoff = new Date(now - lobbyTimeoutMs);
        const playingCutoff = new Date(now - playingTimeoutMs);
        const stale = await prisma.room.findMany({
          where: {
            OR: [
              {
                status: RoomStatus.LOBBY,
                createdAt: { lt: lobbyCutoff }
              },
              {
                status: RoomStatus.PLAYING,
                createdAt: { lt: playingCutoff }
              }
            ]
          },
          select: { id: true, game: { select: { id: true } } }
        });
        for (const r of stale) {
          await this.saveGameHistory(r.id, "cancelled");
          await prisma.room.update({
            where: { id: r.id },
            data: { status: RoomStatus.CANCELLED }
          });
          if (r.game) {
            await prisma.game.update({
              where: { id: r.game.id },
              data: { phase: GamePhase.FINISHED, timerEndsAt: null }
            });
          }
          this.stopTimer(r.id);
        }

        // Step 2: purge old finished/cancelled rooms.
        const deleteCutoff = new Date(Date.now() - ageMs);
        await prisma.room.deleteMany({
          where: {
            status: { in: [RoomStatus.FINISHED, RoomStatus.CANCELLED] },
            updatedAt: { lt: deleteCutoff }
          }
        });
      } catch (error) {
        console.error("cleanup sweep failed", error);
      }
    };
    this.cleanupTimer = setInterval(sweep, intervalMs);
    void sweep();
  }

  async createRoom(input: CreateRoomInput) {
    const winnerTarget = this.normalizeWinnerTarget(input.winnerTarget);
    const maxPlayers = Math.max(3, Math.min(input.maxPlayers ?? 10, 10));
    const code = await this.generateRoomCode();

    const room = await prisma.room.create({
      data: {
        code,
        hostSessionId: input.sessionId,
        hostUserId: input.hostUserId ?? null,
        winnerTarget,
        maxPlayers,
        isAdult: !!input.isAdult,
        players: {
          create: {
            name: input.hostName.trim(),
            sessionId: input.sessionId,
            userId: input.hostUserId ?? null,
            isHost: true,
            seatOrder: 1
          }
        },
        game: {
          create: {
            phase: GamePhase.LOBBY
          }
        }
      },
      include: {
        players: true
      }
    });

    return {
      roomCode: room.code,
      playerId: room.players[0]?.id
    };
  }

  async joinRoom(input: JoinRoomInput) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: {
        players: {
          orderBy: { seatOrder: "asc" }
        }
      }
    });

    if (!room) {
      throw new Error("Room topilmadi.");
    }

    if (room.status !== RoomStatus.LOBBY) {
      throw new Error("O'yin boshlanganidan keyin yangi o'yinchi qo'shila olmaydi.");
    }

    // If the user is authenticated and already in this room from another
    // device, transfer their Player record to the current sessionId.
    if (input.userId) {
      const byUser = room.players.find((p) => p.userId === input.userId);
      if (byUser && byUser.sessionId !== input.sessionId) {
        const updated = await prisma.player.update({
          where: { id: byUser.id },
          data: { sessionId: input.sessionId }
        });
        return { roomCode: room.code, playerId: updated.id };
      }
    }

    const existing = room.players.find(
      (player) => player.sessionId === input.sessionId
    );

    if (existing) {
      // Backfill userId if newly authenticated since join.
      if (input.userId && !existing.userId) {
        await prisma.player.update({
          where: { id: existing.id },
          data: { userId: input.userId }
        });
      }
      return { roomCode: room.code, playerId: existing.id };
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error("Xona to'lib bo'lgan.");
    }

    const player = await prisma.player.create({
      data: {
        roomId: room.id,
        name: input.name.trim(),
        sessionId: input.sessionId,
        userId: input.userId ?? null,
        seatOrder: room.players.length + 1
      }
    });

    // Push the new state to everyone already in the lobby right away. The
    // joining client's own socket will reconnect/emit "join_room" shortly
    // after this HTTP response — but if we wait for that, existing lobby
    // members occasionally don't see the new player until they manually
    // refresh (Telegram WebApp socket reconnects can be slow).
    await this.realtime.broadcastRoomState(room.code);

    return { roomCode: room.code, playerId: player.id };
  }

  async getRoomState(code: string, sessionId: string): Promise<PublicRoomState> {
    const room = await this.getRoomWithState(code);

    if (!room || !room.game) {
      throw new Error("Room state topilmadi.");
    }

    return this.buildRoomState(room, sessionId);
  }

  // Pre-loaded version: assumes the caller already fetched the room with
  // all relations. Lets `broadcastRoomState` query the DB ONCE and reuse
  // the result for every connected socket — large lobbies used to do N+1
  // queries per phase change.
  async getRoomStateForBroadcast(code: string): Promise<{
    room: NonNullable<Awaited<ReturnType<GameService["getRoomWithState"]>>>;
    perSession: (sessionId: string) => PublicRoomState;
  }> {
    const room = await this.getRoomWithState(code);
    if (!room || !room.game) {
      throw new Error("Room state topilmadi.");
    }
    return {
      room,
      perSession: (sessionId: string) => this.buildRoomState(room, sessionId)
    };
  }

  private buildRoomState(
    room: NonNullable<Awaited<ReturnType<GameService["getRoomWithState"]>>>,
    sessionId: string
  ): PublicRoomState {
    if (!room.game) {
      throw new Error("Room state topilmadi.");
    }
    const me = room.players.find((player) => player.sessionId === sessionId) ?? null;
    const remainingSeconds = this.getRemainingSeconds(room.game.timerEndsAt);
    const currentRoundNumber = room.game.roundNumber;

    return {
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        round: room.round,
        winnerTarget: room.winnerTarget,
        maxPlayers: room.maxPlayers
      },
      game: {
        phase: room.game.phase,
        roundNumber: room.game.roundNumber,
        timerEndsAt: room.game.timerEndsAt ? room.game.timerEndsAt.toISOString() : null,
        remainingSeconds,
        currentTurnPlayerId: room.game.currentTurnPlayerId,
        lastRevealedPlayerId: room.game.lastRevealedPlayerId,
        lastRevealedCardType: room.game.lastRevealedCardType,
        lastEliminatedPlayerId: room.game.lastEliminatedPlayerId,
        tiebreakCandidateIds: room.game.tiebreakCandidateIds,
        disaster: room.game.disaster
          ? {
              name: room.game.disaster.name,
              description: room.game.disaster.description
            }
          : null,
        situation: room.game.currentSituation
          ? {
              text: room.game.currentSituation.text,
              difficulty: room.game.currentSituation.difficulty
            }
          : null
      },
      me: me
        ? {
            id: me.id,
            name: me.name,
            isHost: me.isHost,
            isAlive: me.isAlive,
            sessionId: me.sessionId,
            cards: this.extractCards(me.attributes),
            revealed: me.attributes?.revealed ?? []
          }
        : null,
      players: room.players.map((player) => {
        // When the game is over, every player's full hand becomes public —
        // both winners (alive) and eliminated players. During the game, only
        // eliminated players' full hand is exposed; the rest stays hidden
        // except for cards the player has chosen to reveal.
        const gameOver = room.status === RoomStatus.FINISHED;
        const showAll = gameOver || !player.isAlive;
        const isOnline =
          this.realtime.isSessionOnline?.(room.code, player.sessionId) ?? true;
        return {
          id: player.id,
          name: player.name,
          isHost: player.isHost,
          isAlive: player.isAlive,
          online: isOnline,
          seatOrder: player.seatOrder,
          visibleCards: showAll
            ? this.extractCards(player.attributes)
            : this.extractRevealedCards(player.attributes),
          revealedCards: this.extractRevealedCards(player.attributes),
          revealedCount: player.attributes?.revealed.length ?? 0
        };
      }),
      votes: {
        total: room.votes.filter((vote) => vote.roundNumber === currentRoundNumber).length,
        submittedByMe: me
          ? room.votes.some(
              (vote) => vote.roundNumber === currentRoundNumber && vote.voterPlayerId === me.id
            )
          : false
      }
    };
  }

  async startGame(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (room.players.length < 3) {
      throw new Error("O'yinni boshlash uchun kamida 3 o'yinchi kerak.");
    }

    // 18+ rooms can pull from both pools (more variety); normal rooms
    // only see family-friendly content. Filter at the source so admins
    // can flip a single flag and have it propagate everywhere.
    const adultFilter = room.isAdult ? {} : { isAdult: false };
    const [disasters, cards] = await Promise.all([
      prisma.disaster.findMany({ where: adultFilter }),
      prisma.card.findMany({
        where: adultFilter,
        select: { id: true, type: true, text: true, isAdult: true }
      })
    ]);

    if (!disasters.length || !cards.length) {
      throw new Error("Seed ma'lumotlari topilmadi.");
    }

    // Disaster cooldown: avoid back-to-back repeats for THIS host. Falls
    // back to the full pool if cooldown filtered everyone out.
    const hostKey = this.hostCooldownKey(room);
    const selectedDisaster = (() => {
      const recent = GameService.cooldownActive(
        GameService.recentDisasters,
        hostKey,
        GameService.RECENT_DISASTER_TTL_MS
      );
      const fresh = disasters.filter((d) => !recent.has(d.id));
      const pool = fresh.length > 0 ? fresh : disasters;
      const picked = pool[randomInt(pool.length)];
      GameService.cooldownAdd(GameService.recentDisasters, hostKey, [
        picked.id
      ]);
      return picked;
    })();
    const introEndsAt = new Date(Date.now() + 120_000);

    // Deal a unique card per player for every type. Each player has their
    // own personal cooldown (last 2h of cards they were dealt), so
    // back-to-back games avoid repeating cards for the SAME player even if
    // a different host runs the next room. 18+ rooms guarantee at least
    // one adult card per hand.
    const dealPlayers = room.players.map((p) => ({
      userKey: p.userId ?? `session:${p.sessionId}`
    }));
    const deal = this.buildUniqueDeal(cards, dealPlayers, {
      adultMode: !!room.isAdult
    });

    await prisma.$transaction(async (tx) => {
      if (room.game) {
        await tx.vote.deleteMany({ where: { roomId: room.id } });
        await tx.playerAttribute.deleteMany({ where: { gameId: room.game.id } });
      }

      const startedAt = new Date();
      const game = room.game
        ? await tx.game.update({
            where: { id: room.game.id },
            data: {
              disasterId: selectedDisaster.id,
              currentSituationId: null,
              phase: GamePhase.INTRO,
              timerEndsAt: introEndsAt,
              startedAt,
              roundNumber: 0,
              currentTurnPlayerId: null,
              lastRevealedPlayerId: null,
              lastRevealedCardType: null,
              lastEliminatedPlayerId: null
            }
          })
        : await tx.game.create({
            data: {
              roomId: room.id,
              disasterId: selectedDisaster.id,
              phase: GamePhase.INTRO,
              timerEndsAt: introEndsAt,
              startedAt,
              roundNumber: 0
            }
          });

      for (let index = 0; index < room.players.length; index += 1) {
        const player = room.players[index];

        await tx.player.update({
          where: { id: player.id },
          data: { isAlive: true }
        });

        await tx.playerAttribute.create({
          data: {
            playerId: player.id,
            gameId: game.id,
            profession: deal[CardType.PROFESSION][index],
            health: deal[CardType.HEALTH][index],
            character: deal[CardType.CHARACTER][index],
            skill: deal[CardType.SKILL][index],
            baggage: deal[CardType.BAGGAGE][index],
            fact: deal[CardType.FACT][index],
            revealed: [CardType.PROFESSION]
          }
        });
      }

      await tx.room.update({
        where: { id: room.id },
        data: {
          status: RoomStatus.PLAYING,
          round: 0
        }
      });
    });

    this.startTimer(room.code);
  }

  async startRound(input: RoomCodeAction) {
    await this.requireHostRoom(input);
    await this.beginNextRound(input.code);
  }

  async advanceTurn(input: RoomCodeAction) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: { game: true, players: true }
    });

    if (!room) {
      throw new Error("Room topilmadi.");
    }

    const me = room.players.find(
      (player) => player.sessionId === input.sessionId
    );

    if (!me) {
      throw new Error("O'yinchi topilmadi.");
    }

    const isCurrentPitcher =
      room.game?.phase === GamePhase.ROUND_PITCH &&
      room.game.currentTurnPlayerId === me.id;

    if (!me.isHost && !isCurrentPitcher) {
      throw new Error("Bu amal faqat host yoki pitch qilayotgan o'yinchi uchun.");
    }

    await this.advanceTurnForRoom(input.code);
  }

  async startVoting(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (!room.game || room.game.phase !== GamePhase.ROUND_COMPLETE) {
      throw new Error("Hozir voting boshlash mumkin emas.");
    }

    await prisma.$transaction([
      prisma.vote.deleteMany({
        where: {
          roomId: room.id,
          roundNumber: room.game.roundNumber
        }
      }),
      prisma.game.update({
        where: { id: room.game.id },
        data: {
          phase: GamePhase.VOTING,
          timerEndsAt: new Date(Date.now() + 45_000),
          currentTurnPlayerId: null,
          tiebreakCandidateIds: []
        }
      })
    ]);

    this.startTimer(room.code);
  }

  async skipVoting(input: RoomCodeAction) {
    await this.requireHostRoom(input);
    await this.beginNextRound(input.code);
  }

  async leaveRoom(input: RoomCodeAction) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: { players: true }
    });
    if (!room) throw new Error("Room topilmadi.");
    if (room.status !== RoomStatus.LOBBY) {
      throw new Error("O'yin boshlanganidan keyin chiqib bo'lmaydi.");
    }
    const me = room.players.find((p) => p.sessionId === input.sessionId);
    if (!me) throw new Error("O'yinchi topilmadi.");
    if (me.isHost) {
      throw new Error("Host xonadan chiqa olmaydi. O'yinni tugating yoki bekor qiling.");
    }
    await prisma.player.delete({ where: { id: me.id } });
  }

  async kickPlayer(input: RoomCodeAction & { targetPlayerId: string }) {
    const room = await this.requireHostRoom(input);

    if (!room.game) {
      throw new Error("O'yin state topilmadi.");
    }

    const target = room.players.find((p) => p.id === input.targetPlayerId);
    if (!target) {
      throw new Error("O'yinchi topilmadi.");
    }
    if (target.isHost) {
      throw new Error("Hostni chiqarib bo'lmaydi.");
    }
    if (!target.isAlive) {
      throw new Error("Bu o'yinchi allaqachon chiqib ketgan.");
    }

    const targetAttributes = await prisma.playerAttribute.findUnique({
      where: { playerId: target.id }
    });
    const wasCurrentTurn = room.game.currentTurnPlayerId === target.id;
    const gameId = room.game.id;
    const roomId = room.id;

    let didFinish = false;

    await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: target.id },
        data: { isAlive: false }
      });
      if (targetAttributes) {
        await tx.playerAttribute.update({
          where: { id: targetAttributes.id },
          data: { revealed: CARD_TYPES.slice() as CardType[] }
        });
      }

      const aliveCount = await tx.player.count({
        where: { roomId, isAlive: true }
      });

      if (aliveCount <= room.winnerTarget) {
        await tx.room.update({
          where: { id: roomId },
          data: { status: RoomStatus.FINISHED }
        });
        await tx.game.update({
          where: { id: gameId },
          data: {
            phase: GamePhase.FINISHED,
            timerEndsAt: null,
            currentTurnPlayerId: null,
            lastEliminatedPlayerId: target.id,
            tiebreakCandidateIds: []
          }
        });
        didFinish = true;
        return;
      }

      await tx.game.update({
        where: { id: gameId },
        data: {
          lastEliminatedPlayerId: target.id,
          ...(wasCurrentTurn ? { currentTurnPlayerId: null } : {})
        }
      });
    });

    if (didFinish) {
      this.stopTimer(room.code);
      await this.saveGameHistory(roomId, "manualEnd");
      return;
    }

    // If we just removed the player whose turn it was, push the round
    // forward so the game doesn't get stuck waiting on them.
    if (wasCurrentTurn) {
      await this.advanceTurnForRoom(room.code);
    }
  }

  async endGame(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (!room.game) {
      throw new Error("O'yin state topilmadi.");
    }

    // Idempotency guard: if the room is already wrapped up there's nothing
    // to do. Without this, a rapid double-click on "tugatish" would race —
    // the second call would see status=CANCELLED and incorrectly classify
    // the end as "manualEnd" → HOSTED, producing both a CANCELLED and a
    // HOSTED history row for the same lobby.
    if (
      room.status === RoomStatus.FINISHED ||
      room.status === RoomStatus.CANCELLED
    ) {
      return;
    }

    this.stopTimer(room.code);

    // Lobby vaqtida tugatish = o'yin umuman boshlanmagan. Status CANCELLED
    // bo'ladi, GameHistory'da `outcome: CANCELLED` deb yoziladi va host'ning
    // oylik limiti aslida ishlatilgan o'yin sifatida hisoblanmaydi (cancelled
    // chiqaruvchi default bo'lib limit hisobiga kirsa-da, bu ataylab —
    // spam'ga qarshi).
    const wasInLobby = room.status === RoomStatus.LOBBY;

    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: {
          status: wasInLobby ? RoomStatus.CANCELLED : RoomStatus.FINISHED
        }
      }),
      prisma.game.update({
        where: { id: room.game.id },
        data: {
          phase: GamePhase.FINISHED,
          timerEndsAt: null,
          currentTurnPlayerId: null
        }
      })
    ]);

    await this.saveGameHistory(room.id, wasInLobby ? "cancelled" : "manualEnd");
  }

  private async saveGameHistory(
    roomId: string,
    kind: "natural" | "manualEnd" | "cancelled"
  ) {
    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          game: { include: { disaster: true } },
          players: true
        }
      });
      if (!room?.hostUserId) return;

      // Idempotency: skip if a history row for this room already exists in
      // the last 60 seconds. Multiple end-paths can fire in quick
      // succession (e.g. kickPlayer → didFinish AND a queued endGame call,
      // or voting resolution running concurrently with a manual tugatish),
      // and we don't want duplicate rows.
      const recent = await prisma.gameHistory.findFirst({
        where: {
          userId: room.hostUserId,
          roomCode: room.code,
          playedAt: { gte: new Date(Date.now() - 60_000) }
        },
        select: { id: true }
      });
      if (recent) return;

      const hostPlayer = room.players.find(
        (p) => p.sessionId === room.hostSessionId
      );
      let outcome: GameOutcome;
      if (kind === "cancelled") {
        outcome = GameOutcome.CANCELLED;
      } else if (kind === "manualEnd") {
        outcome = GameOutcome.HOSTED;
      } else if (hostPlayer?.isAlive) {
        outcome = GameOutcome.WON;
      } else if (hostPlayer) {
        outcome = GameOutcome.ELIMINATED;
      } else {
        outcome = GameOutcome.PLAYED;
      }

      const endedAt = new Date();
      const startedAt = room.game?.startedAt ?? null;
      const durationSeconds =
        startedAt && kind !== "cancelled"
          ? Math.max(
              0,
              Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
            )
          : null;

      await prisma.gameHistory.create({
        data: {
          userId: room.hostUserId,
          playedAt: endedAt,
          startedAt,
          endedAt: kind === "cancelled" ? null : endedAt,
          durationSeconds,
          disasterName: room.game?.disaster?.name ?? null,
          outcome,
          roomCode: room.code,
          playerCount: room.players.length
        }
      });
    } catch (error) {
      console.error("saveGameHistory failed", error);
    }
  }

  async nextPhase(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (!room.game) {
      throw new Error("O'yin state topilmadi.");
    }

    if (room.game.phase === GamePhase.INTRO || room.game.phase === GamePhase.ROUND_COMPLETE) {
      await this.beginNextRound(room.code);
      return;
    }

    if (room.game.phase === GamePhase.ROUND_PITCH) {
      await this.advanceTurnForRoom(room.code);
      return;
    }

    if (room.game.phase === GamePhase.VOTING) {
      await this.resolveVoting(room.code);
    }
  }

  async revealCard(input: RevealInput) {
    const room = await this.getRoomWithState(input.code);

    if (!room?.game) {
      throw new Error("Room topilmadi.");
    }

    if (room.game.phase !== GamePhase.ROUND_REVEAL) {
      throw new Error("Hozir kartani ochish bosqichi emas.");
    }

    const me = room.players.find((player) => player.sessionId === input.sessionId);

    if (!me || !me.attributes || !me.isAlive) {
      throw new Error("Kartani ochish uchun aktiv o'yinchi bo'lish kerak.");
    }

    if (room.game.currentTurnPlayerId !== me.id) {
      throw new Error("Hozir navbat sizda emas.");
    }

    if (input.cardType === CardType.PROFESSION) {
      throw new Error("Kasb kartasi avtomatik ochilgan.");
    }

    if (me.attributes.revealed.includes(input.cardType)) {
      throw new Error("Bu karta allaqachon ochilgan.");
    }

    await prisma.$transaction([
      prisma.playerAttribute.update({
        where: { id: me.attributes.id },
        data: {
          revealed: [...me.attributes.revealed, input.cardType]
        }
      }),
      prisma.game.update({
        where: { id: room.game.id },
        data: {
          phase: GamePhase.ROUND_PITCH,
          timerEndsAt: new Date(Date.now() + 120_000),
          lastRevealedPlayerId: me.id,
          lastRevealedCardType: input.cardType
        }
      })
    ]);

    this.startTimer(room.code);
  }

  async submitVote(input: VoteInput) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: {
        game: true,
        players: true
      }
    });

    if (!room || !room.game) {
      throw new Error("Room topilmadi.");
    }

    if (room.game.phase !== GamePhase.VOTING) {
      throw new Error("Hozir voting bosqichi emas.");
    }

    const me = room.players.find((player) => player.sessionId === input.sessionId);
    const target = room.players.find((player) => player.id === input.targetPlayerId);

    if (!me || !me.isAlive) {
      throw new Error("Faqat tirik o'yinchi ovoz bera oladi.");
    }

    if (!target || !target.isAlive) {
      throw new Error("Noto'g'ri target tanlandi.");
    }

    if (me.id === target.id) {
      throw new Error("O'zingizga ovoz bera olmaysiz.");
    }

    const tiebreakCandidates = room.game.tiebreakCandidateIds;
    const tiebreakActive = tiebreakCandidates.length > 0;

    if (tiebreakActive) {
      if (tiebreakCandidates.includes(me.id)) {
        throw new Error("Tenglikdagi nomzodlar ovoz bera olmaydi.");
      }
      if (!tiebreakCandidates.includes(target.id)) {
        throw new Error("Faqat tenglikdagi nomzodlardan birini tanlang.");
      }
    }

    await prisma.vote.upsert({
      where: {
        roomId_roundNumber_voterPlayerId: {
          roomId: room.id,
          roundNumber: room.game.roundNumber,
          voterPlayerId: me.id
        }
      },
      create: {
        roomId: room.id,
        roundNumber: room.game.roundNumber,
        voterPlayerId: me.id,
        targetPlayerId: target.id
      },
      update: {
        targetPlayerId: target.id
      }
    });

    const alivePlayers = room.players.filter((player) => player.isAlive);
    const expectedVoters = tiebreakActive
      ? alivePlayers.filter((p) => !tiebreakCandidates.includes(p.id)).length
      : alivePlayers.length;
    const roundVotes = await prisma.vote.count({
      where: {
        roomId: room.id,
        roundNumber: room.game.roundNumber
      }
    });

    if (roundVotes >= expectedVoters) {
      await this.resolveVoting(room.code);
    }
  }

  async broadcastState(roomCode: string) {
    await this.realtime.broadcastRoomState(roomCode.toUpperCase());
  }

  async shutdown() {
    for (const [roomCode] of this.timers) {
      this.stopTimer(roomCode);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private async requireHostRoom(input: RoomCodeAction) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: {
        game: true,
        players: {
          orderBy: { seatOrder: "asc" }
        }
      }
    });

    if (!room) {
      throw new Error("Room topilmadi.");
    }

    const me = room.players.find((player) => player.sessionId === input.sessionId);

    if (!me?.isHost) {
      throw new Error("Bu amal faqat host uchun.");
    }

    return room;
  }

  private async beginNextRound(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);

    if (!room?.game) {
      throw new Error("Room topilmadi.");
    }

    if (
      room.game.phase !== GamePhase.INTRO &&
      room.game.phase !== GamePhase.ROUND_COMPLETE
    ) {
      throw new Error("Hozir yangi round boshlash mumkin emas.");
    }

    const nextRound = room.round + 1;
    const nextSituation = await this.pickSituation(
      room.game.currentSituationId ?? undefined,
      room.isAdult
    );

    const stillEligible = room.players.some(
      (player) =>
        player.isAlive &&
        player.attributes &&
        (player.attributes.revealed.length ?? 0) < nextRound + 1
    );

    if (!stillEligible) {
      throw new Error("Reveal uchun aktiv o'yinchi topilmadi.");
    }

    this.stopTimer(room.code);

    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { round: nextRound }
      }),
      prisma.game.update({
        where: { id: room.game.id },
        data: {
          roundNumber: nextRound,
          currentSituationId: nextSituation.id,
          phase: GamePhase.ROUND_REVEAL,
          timerEndsAt: null,
          currentTurnPlayerId: null,
          lastEliminatedPlayerId: null,
          lastRevealedPlayerId: null,
          lastRevealedCardType: null
        }
      })
    ]);
  }

  async startRoundReveals(input: RoomCodeAction) {
    await this.requireHostRoom(input);
    await this.startRevealsForRoom(input.code);
  }

  private async startRevealsForRoom(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);

    if (!room?.game) {
      throw new Error("Room topilmadi.");
    }

    if (room.game.phase !== GamePhase.ROUND_REVEAL) {
      throw new Error("Hozir reveal bosqichi emas.");
    }

    if (room.game.currentTurnPlayerId) {
      throw new Error("Reveal allaqachon boshlangan.");
    }

    const next = this.findNextRevealPlayer(
      room.players,
      room.game.roundNumber,
      null
    );

    if (!next) {
      throw new Error("Reveal uchun aktiv o'yinchi topilmadi.");
    }

    await prisma.game.update({
      where: { id: room.game.id },
      data: {
        currentTurnPlayerId: next.id,
        timerEndsAt: null
      }
    });
  }

  private async advanceTurnForRoom(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);

    if (!room?.game) {
      throw new Error("Room topilmadi.");
    }

    if (
      room.game.phase !== GamePhase.ROUND_PITCH &&
      room.game.phase !== GamePhase.ROUND_REVEAL
    ) {
      throw new Error("Hozir keyingi o'yinchiga o'tish mumkin emas.");
    }

    const nextTurn = this.findNextRevealPlayer(
      room.players,
      room.game.roundNumber,
      room.game.currentTurnPlayerId
    );

    this.stopTimer(room.code);

    await prisma.game.update({
      where: { id: room.game.id },
      data: nextTurn
        ? {
            phase: GamePhase.ROUND_REVEAL,
            timerEndsAt: null,
            currentTurnPlayerId: nextTurn.id
          }
        : {
            phase: GamePhase.ROUND_COMPLETE,
            timerEndsAt: null,
            currentTurnPlayerId: null
          }
    });
  }

  private async resolveVoting(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);

    if (!room || !room.game) {
      throw new Error("Room topilmadi.");
    }

    const currentRoundVotes = room.votes.filter(
      (vote) => vote.roundNumber === room.game?.roundNumber
    );

    const aliveBeforeVote = room.players.filter((p) => p.isAlive);
    const isEndgame = aliveBeforeVote.length <= room.winnerTarget + 1;

    let eliminatedId: string;

    if (!currentRoundVotes.length) {
      // No votes — at endgame we must force progress (2 players refusing to
      // vote against each other would otherwise loop forever). Otherwise let
      // the round end without elimination.
      if (!isEndgame) {
        await prisma.game.update({
          where: { id: room.game.id },
          data: {
            phase: GamePhase.ROUND_COMPLETE,
            timerEndsAt: null,
            tiebreakCandidateIds: []
          }
        });
        this.stopTimer(room.code);
        return;
      }

      eliminatedId = aliveBeforeVote[randomInt(aliveBeforeVote.length)].id;
    } else {
      const score = new Map<string, number>();

      for (const vote of currentRoundVotes) {
        score.set(
          vote.targetPlayerId,
          (score.get(vote.targetPlayerId) ?? 0) + 1
        );
      }

      const topScore = Math.max(...score.values());
      const candidates = [...score.entries()]
        .filter(([, value]) => value === topScore)
        .map(([playerId]) => playerId);

      if (candidates.length > 1) {
        // Tie — enter (or repeat) a tiebreak vote. Eligible voters are alive
        // players not in the tied set; if none exist we have no choice but
        // to fall back to a random pick.
        const eligibleVoters = aliveBeforeVote.filter(
          (p) => !candidates.includes(p.id)
        );

        if (eligibleVoters.length > 0) {
          this.stopTimer(room.code);
          await prisma.$transaction([
            prisma.vote.deleteMany({
              where: {
                roomId: room.id,
                roundNumber: room.game.roundNumber
              }
            }),
            prisma.game.update({
              where: { id: room.game.id },
              data: {
                phase: GamePhase.VOTING,
                timerEndsAt: new Date(Date.now() + 45_000),
                tiebreakCandidateIds: candidates
              }
            })
          ]);
          this.startTimer(room.code);
          return;
        }

        eliminatedId = candidates[randomInt(candidates.length)];
      } else {
        eliminatedId = candidates[0];
      }
    }

    const eliminatedPlayer = room.players.find((player) => player.id === eliminatedId);
    const gameId = room.game.id;

    this.stopTimer(room.code);

    let didFinish = false;

    await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: eliminatedId },
        data: { isAlive: false }
      });

      if (eliminatedPlayer?.attributes) {
        await tx.playerAttribute.update({
          where: { id: eliminatedPlayer.attributes.id },
          data: { revealed: CARD_TYPES.slice() as CardType[] }
        });
      }

      const aliveCount = await tx.player.count({
        where: {
          roomId: room.id,
          isAlive: true
        }
      });

      if (aliveCount <= room.winnerTarget) {
        await tx.room.update({
          where: { id: room.id },
          data: { status: RoomStatus.FINISHED }
        });
        await tx.game.update({
          where: { id: gameId },
          data: {
            phase: GamePhase.FINISHED,
            timerEndsAt: null,
            currentTurnPlayerId: null,
            lastEliminatedPlayerId: eliminatedId,
            tiebreakCandidateIds: []
          }
        });
        didFinish = true;
        return;
      }

      await tx.game.update({
        where: { id: gameId },
        data: {
          phase: GamePhase.ROUND_COMPLETE,
          timerEndsAt: null,
          currentTurnPlayerId: null,
          lastEliminatedPlayerId: eliminatedId,
          tiebreakCandidateIds: []
        }
      });
    });

    if (didFinish) {
      await this.saveGameHistory(room.id, "natural");
    }
  }

  private findNextRevealPlayer(
    players: RoomWithState["players"],
    roundNumber: number,
    excludePlayerId?: string | null
  ) {
    const targetRevealCount = roundNumber + 1;
    const eligible = players.filter(
      (player) =>
        player.isAlive &&
        player.attributes &&
        player.id !== excludePlayerId &&
        (player.attributes.revealed.length ?? 0) < targetRevealCount
    );

    if (!eligible.length) {
      return null;
    }

    return eligible[randomInt(eligible.length)];
  }

  private async getRoomWithState(code: string) {
    return prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: {
          include: {
            attributes: true
          },
          orderBy: { seatOrder: "asc" }
        },
        game: {
          include: {
            disaster: true,
            currentSituation: true
          }
        },
        votes: true
      }
    });
  }

  private async pickSituation(excludeId: string | undefined, isAdult: boolean) {
    const where: { id?: { not: string }; isAdult?: false } = {};
    if (excludeId) where.id = { not: excludeId };
    if (!isAdult) where.isAdult = false;
    const situations = await prisma.situation.findMany({ where });

    if (!situations.length) {
      throw new Error("Situation ma'lumotlari topilmadi.");
    }

    // Server-wide cooldown: any situation used recently by anyone is de-
    // prioritised so the whole game-night cycles through fresh prompts.
    // Falls back to the full pool when cooldown filters everything.
    const now = Date.now();
    for (const [id, ts] of GameService.recentSituations) {
      if (now - ts > GameService.RECENT_SITUATION_TTL_MS) {
        GameService.recentSituations.delete(id);
      }
    }
    const fresh = situations.filter(
      (s) => !GameService.recentSituations.has(s.id)
    );
    const pool = fresh.length > 0 ? fresh : situations;
    const picked = pool[randomInt(pool.length)];
    GameService.recentSituations.set(picked.id, now);
    return picked;
  }

  private async generateRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
      const exists = await prisma.room.findUnique({ where: { code } });

      if (!exists) {
        return code;
      }
    }

    throw new Error("Room code yaratib bo'lmadi.");
  }

  private normalizeWinnerTarget(value: number) {
    if ([1, 2, 3].includes(value)) {
      return value;
    }

    return 1;
  }

  // Cooldown stores. In-memory only (no Redis): single API instance is
  // assumed; restart resets every cooldown, which is harmless.
  //
  // Cards: per-USER. Each player carries their own "I just saw these"
  // history so they don't see the same kasb/sog'liq twice in a row even
  // if a different host runs the room.
  private static readonly RECENT_CARD_TTL_MS = 2 * 60 * 60 * 1000;
  private static recentCardsByUser: Map<string, Map<string, number>> =
    new Map();
  // Disasters: per-HOST. Whoever creates the room shouldn't get the same
  // disaster two games in a row.
  private static readonly RECENT_DISASTER_TTL_MS = 60 * 60 * 1000;
  private static recentDisasters: Map<string, Map<string, number>> = new Map();
  // Situations: SERVER-WIDE. Round prompts are shared across all hosts so
  // the entire game-night avoids recycling the same vaziyatlar regardless
  // of who creates each room.
  private static readonly RECENT_SITUATION_TTL_MS = 30 * 60 * 1000;
  private static recentSituations: Map<string, number> = new Map();

  private static cooldownActive(
    store: Map<string, Map<string, number>>,
    hostKey: string,
    ttlMs: number
  ): Set<string> {
    const now = Date.now();
    const bucket = store.get(hostKey);
    if (!bucket) return new Set();
    for (const [id, ts] of bucket) {
      if (now - ts > ttlMs) bucket.delete(id);
    }
    if (bucket.size === 0) {
      store.delete(hostKey);
      return new Set();
    }
    return new Set(bucket.keys());
  }

  private static cooldownAdd(
    store: Map<string, Map<string, number>>,
    hostKey: string,
    ids: Iterable<string>
  ): void {
    let bucket = store.get(hostKey);
    if (!bucket) {
      bucket = new Map();
      store.set(hostKey, bucket);
    }
    const now = Date.now();
    for (const id of ids) bucket.set(id, now);
  }

  private hostCooldownKey(room: {
    hostUserId: string | null;
    hostSessionId: string;
  }): string {
    return room.hostUserId ?? `session:${room.hostSessionId}`;
  }

  private fisherYatesShuffle<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Each player carries their own card cooldown so back-to-back games don't
  // hand them the same kasb/sog'liq even if a different friend hosts the
  // next room. The deal still has to be unique within a single game (no two
  // players hold the same card) so we deal greedily, picking each player's
  // card from the cards still available in the pool, preferring ones they
  // haven't seen recently.
  private buildUniqueDeal(
    cards: Array<{ id: string; type: CardType; text: string; isAdult: boolean }>,
    players: Array<{ userKey: string }>,
    options: { adultMode: boolean }
  ): Record<CardType, string[]> {
    const playerCount = players.length;
    const deal = {} as Record<CardType, string[]>;

    // Snapshot each player's personal cooldown once up front.
    const cooldownByIdx = players.map((p) =>
      GameService.cooldownActive(
        GameService.recentCardsByUser,
        p.userKey,
        GameService.RECENT_CARD_TTL_MS
      )
    );

    // Decide WHICH player slot is guaranteed an adult card in WHICH type.
    // Round-robin assigns each player a single guaranteed adult type so
    // every hand contains at least one adult card overall. Skips types
    // without any adult cards in the seed.
    const adultIdxByType = new Map<CardType, Set<number>>();
    if (options.adultMode) {
      const adultsPerType = new Map<CardType, number>();
      for (const c of cards) {
        if (c.isAdult) {
          adultsPerType.set(c.type, (adultsPerType.get(c.type) ?? 0) + 1);
        }
      }
      const typesWithAdults = CARD_TYPES.filter(
        (t) => (adultsPerType.get(t) ?? 0) > 0
      );

      if (typesWithAdults.length > 0) {
        const playerOrder = this.fisherYatesShuffle(
          Array.from({ length: playerCount }, (_, i) => i)
        );
        const usagePerType = new Map<CardType, number>();
        for (const playerIdx of playerOrder) {
          for (let attempt = 0; attempt < typesWithAdults.length; attempt += 1) {
            const type =
              typesWithAdults[(playerIdx + attempt) % typesWithAdults.length];
            const cap = adultsPerType.get(type) ?? 0;
            const used = usagePerType.get(type) ?? 0;
            if (used < cap) {
              usagePerType.set(type, used + 1);
              let bucket = adultIdxByType.get(type);
              if (!bucket) {
                bucket = new Set();
                adultIdxByType.set(type, bucket);
              }
              bucket.add(playerIdx);
              break;
            }
          }
        }
      }
    }

    const dealtIdsByUser = new Map<string, string[]>();

    for (const type of CARD_TYPES) {
      const typePool = cards.filter((c) => c.type === type);

      if (typePool.length < playerCount) {
        throw new Error(
          `${type} kartalari yetarli emas: ${typePool.length} ta bor, ${playerCount} ta kerak.`
        );
      }

      const adultIdxSet = adultIdxByType.get(type) ?? new Set<number>();
      const result: string[] = new Array(playerCount);
      const used = new Set<string>();

      // Process players in random order so the same player slot doesn't
      // always end up with the leftover scraps when the pool is tight.
      const order = this.fisherYatesShuffle(
        Array.from({ length: playerCount }, (_, i) => i)
      );

      for (const idx of order) {
        const cooldown = cooldownByIdx[idx];
        const needsAdult = adultIdxSet.has(idx);

        const remaining = typePool.filter((c) => !used.has(c.id));
        let candidates: typeof typePool;

        if (needsAdult) {
          // Adult slot: fresh adult > any adult > any remaining (last
          // resort if every adult was already taken by a peer).
          const adults = remaining.filter((c) => c.isAdult);
          const freshAdults = adults.filter((c) => !cooldown.has(c.id));
          candidates =
            freshAdults.length > 0
              ? freshAdults
              : adults.length > 0
                ? adults
                : remaining;
        } else {
          // Free slot: fresh > anything left.
          const fresh = remaining.filter((c) => !cooldown.has(c.id));
          candidates = fresh.length > 0 ? fresh : remaining;
        }

        const picked = candidates[randomInt(candidates.length)];
        result[idx] = picked.text;
        used.add(picked.id);

        const userKey = players[idx].userKey;
        let bucket = dealtIdsByUser.get(userKey);
        if (!bucket) {
          bucket = [];
          dealtIdsByUser.set(userKey, bucket);
        }
        bucket.push(picked.id);
      }

      deal[type] = result;
    }

    // Persist each player's hand into their personal cooldown.
    for (const [userKey, ids] of dealtIdsByUser) {
      GameService.cooldownAdd(
        GameService.recentCardsByUser,
        userKey,
        ids
      );
    }

    return deal;
  }

  private extractCards(
    attributes:
      | Prisma.PlayerAttributeGetPayload<Record<string, never>>
      | null
      | undefined
  ): Record<string, string> {
    if (!attributes) {
      return {};
    }

    return {
      [CardType.PROFESSION]: attributes.profession,
      [CardType.HEALTH]: attributes.health,
      [CardType.CHARACTER]: attributes.character,
      [CardType.SKILL]: attributes.skill,
      [CardType.BAGGAGE]: attributes.baggage,
      [CardType.FACT]: attributes.fact
    };
  }

  private extractRevealedCards(
    attributes:
      | Prisma.PlayerAttributeGetPayload<Record<string, never>>
      | null
      | undefined
  ) {
    const cards = this.extractCards(attributes);
    const revealed = attributes?.revealed ?? [];

    return Object.fromEntries(revealed.map((type) => [type, cards[type]]));
  }

  private getRemainingSeconds(timerEndsAt: Date | null) {
    if (!timerEndsAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((timerEndsAt.getTime() - Date.now()) / 1000));
  }

  private startTimer(roomCode: string) {
    this.stopTimer(roomCode);

    const interval = setInterval(async () => {
      try {
        const room = await prisma.room.findUnique({
          where: { code: roomCode.toUpperCase() },
          include: { game: true }
        });

        if (!room?.game?.timerEndsAt) {
          this.stopTimer(roomCode);
          return;
        }

        const remainingSeconds = this.getRemainingSeconds(room.game.timerEndsAt);
        this.realtime.broadcastTimer(roomCode, remainingSeconds);

        if (remainingSeconds > 0) {
          return;
        }

        this.stopTimer(roomCode);

        if (room.game.phase === GamePhase.INTRO) {
          await this.beginNextRound(roomCode);
        } else if (room.game.phase === GamePhase.ROUND_PITCH) {
          await this.advanceTurnForRoom(roomCode);
        } else if (room.game.phase === GamePhase.VOTING) {
          await this.resolveVoting(roomCode);
        }

        await this.realtime.broadcastRoomState(roomCode);
      } catch (error) {
        console.error(error);
        this.stopTimer(roomCode);
      }
    }, 1000);

    this.timers.set(roomCode, interval);
  }

  private stopTimer(roomCode: string) {
    const timer = this.timers.get(roomCode);

    if (timer) {
      clearInterval(timer);
      this.timers.delete(roomCode);
    }
  }
}
