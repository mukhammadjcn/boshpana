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
    const room = await prisma.room.findUnique({
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
            currentSituation: true,
            playerAttributes: true
          }
        },
        votes: true
      }
    });

    if (!room || !room.game) {
      throw new Error("Room state topilmadi.");
    }

    const me = room.players.find((player) => player.sessionId === sessionId) ?? null;
    const remainingSeconds = this.getRemainingSeconds(room.game.timerEndsAt);

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
        revealedCards: this.extractRevealedCards(player.attributes),
        revealedCount: player.attributes?.revealed.length ?? 0
      })),
      votes: {
        total: room.votes.filter((vote) => vote.roundNumber === room.game?.roundNumber).length,
        submittedByMe: me
          ? room.votes.some(
              (vote) =>
                vote.roundNumber === room.game?.roundNumber && vote.voterPlayerId === me.id
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

    const [disasters, situations, cards] = await Promise.all([
      prisma.disaster.findMany(),
      prisma.situation.findMany(),
      prisma.card.findMany()
    ]);

    if (!disasters.length || !situations.length || !cards.length) {
      throw new Error("Seed ma'lumotlari topilmadi.");
    }

    const selectedDisaster = disasters[randomInt(disasters.length)];
    const selectedSituation = situations[randomInt(situations.length)];
    const roomRound = 1;

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
              currentSituationId: selectedSituation.id,
              phase: GamePhase.DISCUSSION,
              timerEndsAt: new Date(Date.now() + 120_000),
              roundNumber: roomRound
            }
          })
        : await tx.game.create({
            data: {
              roomId: room.id,
              disasterId: selectedDisaster.id,
              currentSituationId: selectedSituation.id,
              phase: GamePhase.DISCUSSION,
              timerEndsAt: new Date(Date.now() + 120_000),
              roundNumber: roomRound
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
            revealed: []
          }
        });
      }

      await tx.room.update({
        where: { id: room.id },
        data: {
          status: RoomStatus.PLAYING,
          round: roomRound
        }
      });
    });

    this.startTimer(room.code);
  }

  async nextPhase(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (!room.game) {
      throw new Error("O'yin state topilmadi.");
    }

    if (room.game.phase === GamePhase.DISCUSSION) {
      await prisma.game.update({
        where: { id: room.game.id },
        data: {
          phase: GamePhase.REVEAL,
          timerEndsAt: null
        }
      });
      this.stopTimer(room.code);
      return;
    }

    if (room.game.phase === GamePhase.REVEAL) {
      await prisma.game.update({
        where: { id: room.game.id },
        data: {
          phase: GamePhase.VOTING,
          timerEndsAt: new Date(Date.now() + 45_000)
        }
      });
      this.startTimer(room.code);
      return;
    }

    if (room.game.phase === GamePhase.VOTING) {
      await this.resolveVoting(room.code);
    }
  }

  async revealCard(input: RevealInput) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: {
        game: true,
        players: {
          include: { attributes: true }
        }
      }
    });

    if (!room || !room.game) {
      throw new Error("Room topilmadi.");
    }

    if (room.game.phase !== GamePhase.REVEAL) {
      throw new Error("Hozir reveal bosqichi emas.");
    }

    const me = room.players.find((player) => player.sessionId === input.sessionId);

    if (!me || !me.attributes || !me.isAlive) {
      throw new Error("Reveal qilish uchun aktiv o'yinchi bo'lish kerak.");
    }

    if (me.attributes.revealed.includes(input.cardType)) {
      throw new Error("Bu karta allaqachon ochilgan.");
    }

    if (me.attributes.revealed.length >= room.game.roundNumber) {
      throw new Error("Bu round uchun faqat bitta karta ochish mumkin.");
    }

    await prisma.playerAttribute.update({
      where: { id: me.attributes.id },
      data: {
        revealed: [...me.attributes.revealed, input.cardType]
      }
    });

    const refreshed = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        game: true,
        players: {
          include: { attributes: true }
        }
      }
    });

    const alivePlayers =
      refreshed?.players.filter((player) => player.isAlive && player.attributes) ?? [];
    const everyoneRevealed = alivePlayers.every(
      (player) => (player.attributes?.revealed.length ?? 0) >= (refreshed?.game?.roundNumber ?? 0)
    );

    if (everyoneRevealed && refreshed?.game) {
      await prisma.game.update({
        where: { id: refreshed.game.id },
        data: {
          phase: GamePhase.VOTING,
          timerEndsAt: new Date(Date.now() + 45_000)
        }
      });
      this.startTimer(room.code);
    }
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

  private async resolveVoting(roomCode: string) {
    const room = await prisma.room.findUnique({
      where: { code: roomCode.toUpperCase() },
      include: {
        game: true,
        players: true,
        votes: true
      }
    });

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
          phase: GamePhase.REVEAL,
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

    await prisma.player.update({
      where: { id: eliminatedId },
      data: { isAlive: false }
    });

    const aliveCount = await prisma.player.count({
      where: {
        roomId: room.id,
        isAlive: true
      }
    });

    this.stopTimer(room.code);

    if (aliveCount <= room.winnerTarget) {
      await prisma.$transaction([
        prisma.room.update({
          where: { id: room.id },
          data: {
            status: RoomStatus.FINISHED
          }
        }),
        prisma.game.update({
          where: { id: room.game.id },
          data: {
            phase: GamePhase.FINISHED,
            timerEndsAt: null
          }
        })
      ]);
      return;
    }

    const nextSituation = await this.pickSituation(room.game.currentSituationId ?? undefined);

    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { round: room.round + 1 }
      }),
      prisma.game.update({
        where: { id: room.game.id },
        data: {
          roundNumber: room.game.roundNumber + 1,
          currentSituationId: nextSituation.id,
          phase: GamePhase.DISCUSSION,
          timerEndsAt: new Date(Date.now() + 120_000)
        }
      })
    ]);

    this.startTimer(room.code);
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

        if (room.game.phase === GamePhase.DISCUSSION) {
          await prisma.game.update({
            where: { id: room.game.id },
            data: {
              phase: GamePhase.REVEAL,
              timerEndsAt: null
            }
          });
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
