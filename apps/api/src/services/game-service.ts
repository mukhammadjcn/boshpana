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

    // Deal a unique card per player for every type by shuffling each pool
    // and handing out in order. Throws if a pool is too small.
    const deal = this.buildUniqueDeal(cards, room.players.length);

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

  private buildUniqueDeal(
    cards: Array<{ type: CardType; text: string }>,
    playerCount: number
  ): Record<CardType, string[]> {
    const deal = {} as Record<CardType, string[]>;

    for (const type of CARD_TYPES) {
      const pool = cards.filter((card) => card.type === type).map((c) => c.text);

      if (pool.length < playerCount) {
        throw new Error(
          `${type} kartalari yetarli emas: ${pool.length} ta bor, ${playerCount} ta kerak.`
        );
      }

      // Fisher–Yates shuffle (crypto-randomInt for fairness).
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = randomInt(i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      deal[type] = shuffled.slice(0, playerCount);
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
