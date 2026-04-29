import { CardType, GamePhase, Prisma, RoomStatus } from "@prisma/client";
import { randomBytes, randomInt } from "node:crypto";

import { prisma } from "../lib/prisma";
import { CARD_TYPES, PublicRoomState } from "../types/game";

type RealtimePublisher = {
  broadcastRoomState: (roomCode: string) => Promise<void>;
  broadcastTimer: (roomCode: string, remainingSeconds: number) => void;
};

type CreateRoomInput = {
  hostName: string;
  sessionId: string;
  winnerTarget: number;
  maxPlayers?: number;
};

type JoinRoomInput = {
  code: string;
  name: string;
  sessionId: string;
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
  broadcastTimer: () => undefined
};

export class GameService {
  private realtime: RealtimePublisher = noopRealtime;

  private readonly timers = new Map<string, NodeJS.Timeout>();

  setRealtime(publisher: RealtimePublisher) {
    this.realtime = publisher;
  }

  async createRoom(input: CreateRoomInput) {
    const winnerTarget = this.normalizeWinnerTarget(input.winnerTarget);
    const maxPlayers = Math.max(3, Math.min(input.maxPlayers ?? 10, 10));
    const code = await this.generateRoomCode();

    const room = await prisma.room.create({
      data: {
        code,
        hostSessionId: input.sessionId,
        winnerTarget,
        maxPlayers,
        players: {
          create: {
            name: input.hostName.trim(),
            sessionId: input.sessionId,
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

    const existing = room.players.find((player) => player.sessionId === input.sessionId);

    if (existing) {
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
        seatOrder: room.players.length + 1
      }
    });

    return { roomCode: room.code, playerId: player.id };
  }

  async getRoomState(code: string, sessionId: string): Promise<PublicRoomState> {
    const room = await this.getRoomWithState(code);

    if (!room || !room.game) {
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
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        isAlive: player.isAlive,
        seatOrder: player.seatOrder,
        visibleCards: player.isAlive
          ? this.extractRevealedCards(player.attributes)
          : this.extractCards(player.attributes),
        revealedCards: this.extractRevealedCards(player.attributes),
        revealedCount: player.attributes?.revealed.length ?? 0
      })),
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

    const [disasters, cards] = await Promise.all([
      prisma.disaster.findMany(),
      prisma.card.findMany()
    ]);

    if (!disasters.length || !cards.length) {
      throw new Error("Seed ma'lumotlari topilmadi.");
    }

    const selectedDisaster = disasters[randomInt(disasters.length)];
    const introEndsAt = new Date(Date.now() + 120_000);

    await prisma.$transaction(async (tx) => {
      if (room.game) {
        await tx.vote.deleteMany({ where: { roomId: room.id } });
        await tx.playerAttribute.deleteMany({ where: { gameId: room.game.id } });
      }

      const game = room.game
        ? await tx.game.update({
            where: { id: room.game.id },
            data: {
              disasterId: selectedDisaster.id,
              currentSituationId: null,
              phase: GamePhase.INTRO,
              timerEndsAt: introEndsAt,
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
              roundNumber: 0
            }
          });

      for (const player of room.players) {
        await tx.player.update({
          where: { id: player.id },
          data: { isAlive: true }
        });

        await tx.playerAttribute.create({
          data: {
            playerId: player.id,
            gameId: game.id,
            profession: this.pickRandomCard(cards, CardType.PROFESSION),
            health: this.pickRandomCard(cards, CardType.HEALTH),
            character: this.pickRandomCard(cards, CardType.CHARACTER),
            skill: this.pickRandomCard(cards, CardType.SKILL),
            baggage: this.pickRandomCard(cards, CardType.BAGGAGE),
            fact: this.pickRandomCard(cards, CardType.FACT),
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
    await this.requireHostRoom(input);
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
          currentTurnPlayerId: null
        }
      })
    ]);

    this.startTimer(room.code);
  }

  async skipVoting(input: RoomCodeAction) {
    await this.requireHostRoom(input);
    await this.beginNextRound(input.code);
  }

  async endGame(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (!room.game) {
      throw new Error("O'yin state topilmadi.");
    }

    this.stopTimer(room.code);

    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.FINISHED }
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
    const roundVotes = await prisma.vote.count({
      where: {
        roomId: room.id,
        roundNumber: room.game.roundNumber
      }
    });

    if (roundVotes >= alivePlayers.length) {
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
    const nextSituation = await this.pickSituation(room.game.currentSituationId ?? undefined);
    const currentTurn = this.findNextRevealPlayer(room.players, nextRound, 0);

    if (!currentTurn) {
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
          currentTurnPlayerId: currentTurn.id,
          lastEliminatedPlayerId: null
        }
      })
    ]);
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

    const currentSeat =
      room.players.find((player) => player.id === room.game?.currentTurnPlayerId)?.seatOrder ?? 0;
    const nextTurn = this.findNextRevealPlayer(room.players, room.game.roundNumber, currentSeat);

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

    if (!currentRoundVotes.length) {
      await prisma.game.update({
        where: { id: room.game.id },
        data: {
          phase: GamePhase.ROUND_COMPLETE,
          timerEndsAt: null
        }
      });
      this.stopTimer(room.code);
      return;
    }

    const score = new Map<string, number>();

    for (const vote of currentRoundVotes) {
      score.set(vote.targetPlayerId, (score.get(vote.targetPlayerId) ?? 0) + 1);
    }

    const topScore = Math.max(...score.values());
    const candidates = [...score.entries()]
      .filter(([, value]) => value === topScore)
      .map(([playerId]) => playerId);
    const eliminatedId = candidates[randomInt(candidates.length)];
    const eliminatedPlayer = room.players.find((player) => player.id === eliminatedId);
    const gameId = room.game.id;

    this.stopTimer(room.code);

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
            lastEliminatedPlayerId: eliminatedId
          }
        });
        return;
      }

      await tx.game.update({
        where: { id: gameId },
        data: {
          phase: GamePhase.ROUND_COMPLETE,
          timerEndsAt: null,
          currentTurnPlayerId: null,
          lastEliminatedPlayerId: eliminatedId
        }
      });
    });
  }

  private findNextRevealPlayer(
    players: RoomWithState["players"],
    roundNumber: number,
    afterSeatOrder: number
  ) {
    const targetRevealCount = roundNumber + 1;
    const ordered = players.filter((player) => player.isAlive && player.attributes);

    const next =
      ordered.find(
        (player) =>
          player.seatOrder > afterSeatOrder &&
          (player.attributes?.revealed.length ?? 0) < targetRevealCount
      ) ??
      ordered.find(
        (player) => (player.attributes?.revealed.length ?? 0) < targetRevealCount
      );

    return next ?? null;
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

  private async pickSituation(excludeId?: string) {
    const situations = await prisma.situation.findMany({
      where: excludeId ? { id: { not: excludeId } } : undefined
    });

    if (!situations.length) {
      throw new Error("Situation ma'lumotlari topilmadi.");
    }

    return situations[randomInt(situations.length)];
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

  private pickRandomCard(cards: Array<{ type: CardType; text: string }>, type: CardType) {
    const filtered = cards.filter((card) => card.type === type);

    if (!filtered.length) {
      throw new Error(`Card type bo'sh: ${type}`);
    }

    return filtered[randomInt(filtered.length)].text;
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
