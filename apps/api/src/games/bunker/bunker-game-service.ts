import {
  BunkerCardType,
  GameOutcome,
  BunkerPhase,
  GameType,
  Prisma,
  RoomStatus
} from "@prisma/client";
import { randomBytes, randomInt } from "node:crypto";

import { buildLocalizedText, type LocalizedText } from "../../lib/localized-content";
import { prisma } from "../../lib/prisma";
import { chatService } from "../../services/chat-service";
import { hostTransferService } from "../../services/host-transfer-service";
import { onlineGovernanceService } from "../../services/online-governance-service";
import {
  BUNKER_ONLINE_MIN_PLAYERS,
  applyOnlineBunkerComposition,
  getBunkerEliminationsForRound,
  shouldAutoStartOnlineLobby
} from "../../services/online-lobby-service";
import { joinLobbyRoom } from "../../services/room-membership-service";
import { withRoomActionLock } from "../../services/room-action-lock-service";
import {
  getBunkerIntroDurationSeconds,
  getBunkerRevealDurationSeconds,
  getBunkerRoundResultDurationSeconds,
  isSelfManagedOnlineRoom
} from "../online/online-self-managed-rules";
import {
  BUNKER_PITCH_DURATION_SECONDS,
  BUNKER_VOTING_DURATION_SECONDS,
  CARD_TYPES,
  BunkerPublicState
} from "./bunker-types";

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
  cardType: BunkerCardType;
};

type VoteInput = RoomCodeAction & {
  // Online rounds with multi-elimination expect N targets per voter; friends
  // and tiebreak rounds always expect exactly one. The service validates the
  // count against the schedule before persisting.
  targetPlayerIds: string[];
};

type RoomWithState = Prisma.RoomGetPayload<{
  include: {
    players: {
      include: {
        bunkerAttributes: true;
      };
      orderBy: {
        seatOrder: "asc";
      };
    };
    bunkerGame: {
      include: {
        disaster: true;
        currentSituation: true;
      };
    };
    bunkerVotes: true;
  };
}>;

type CardTranslationMap = Map<string, LocalizedText>;
type CardTagsMap = Map<string, string[]>;

const noopRealtime: RealtimePublisher = {
  broadcastRoomState: async () => undefined,
  broadcastTimer: () => undefined,
  isSessionOnline: () => true
};

export class BunkerGameService {
  private realtime: RealtimePublisher = noopRealtime;

  // Timer entries cache the `timerEndsAt` deadline so the per-second tick
  // can broadcast remaining seconds without a DB round-trip. Only the
  // expiration step (remaining === 0) touches Prisma to read the current
  // phase and trigger resolution. Without this, every active room burned
  // one query per second just to re-read its own deadline.
  private readonly timers = new Map<
    string,
    { interval: NodeJS.Timeout; endsAt: number }
  >();

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
          select: { id: true, code: true, bunkerGame: { select: { id: true } } }
        });
        for (const r of stale) {
          await this.saveGameHistory(r.id, "cancelled");
          await prisma.room.update({
            where: { id: r.id },
            data: { status: RoomStatus.CANCELLED }
          });
          if (r.bunkerGame) {
            await prisma.bunkerGame.update({
              where: { id: r.bunkerGame.id },
              data: { phase: BunkerPhase.FINISHED, timerEndsAt: null }
            });
          }
          this.stopTimer(r.id);
          await chatService.clearRoom(r.code);
          await onlineGovernanceService.clearRoom(r.code);
        }

        // Step 2: purge old finished/cancelled rooms.
        const deleteCutoff = new Date(Date.now() - ageMs);
        const roomsToDelete = await prisma.room.findMany({
          where: {
            status: { in: [RoomStatus.FINISHED, RoomStatus.CANCELLED] },
            updatedAt: { lt: deleteCutoff }
          },
          select: { code: true }
        });
        if (roomsToDelete.length > 0) {
          await prisma.room.deleteMany({
            where: {
              status: { in: [RoomStatus.FINISHED, RoomStatus.CANCELLED] },
              updatedAt: { lt: deleteCutoff }
            }
          });
          await Promise.all(
            roomsToDelete.map(async (room) => {
              await chatService.clearRoom(room.code);
              await onlineGovernanceService.clearRoom(room.code);
            })
          );
        }

        // Step 3: prune the in-memory cooldown stores. `cooldownActive`
        // already prunes a single host's bucket on access, but a host who
        // never returns leaves their bucket sitting around forever. This
        // periodic sweep walks every bucket so memory stays bounded by
        // active users, not lifetime users.
        BunkerGameService.pruneCooldownStores();
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
        bunkerGame: {
          create: {
            phase: BunkerPhase.LOBBY
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
    const result = await joinLobbyRoom({
      ...input,
      expectedGameType: GameType.BUNKER,
      expectedGameLabel: "Bunker"
    });

    // Push the new state to everyone already in the lobby right away. The
    // joining client's own socket will reconnect/emit "join_room" shortly
    // after this HTTP response — but if we wait for that, existing lobby
    // members occasionally don't see the new player until they manually
    // refresh (Telegram WebApp socket reconnects can be slow).
    if (result.didCreatePlayer) {
      await this.realtime.broadcastRoomState(result.roomCode);
    }

    return { roomCode: result.roomCode, playerId: result.playerId };
  }

  async getRoomState(code: string, sessionId: string): Promise<BunkerPublicState> {
    const room = await this.getRoomWithState(code);

    if (!room || !room.bunkerGame) {
      throw new Error("Room state topilmadi.");
    }

    const [cardTranslations, cardTags] = await Promise.all([
      this.loadCardTranslations(),
      this.loadCardTagsMap()
    ]);
    const chatMessages = await chatService.getRecentMessages(room.code);
    const governance = await onlineGovernanceService.getState(room.code);
    return this.buildRoomState(
      room,
      sessionId,
      cardTranslations,
      cardTags,
      chatMessages,
      governance
    );
  }

  // Pre-loaded version: assumes the caller already fetched the room with
  // all relations. Lets `broadcastRoomState` query the DB ONCE and reuse
  // the result for every connected socket — large lobbies used to do N+1
  // queries per phase change.
  async getRoomStateForBroadcast(code: string): Promise<{
    room: NonNullable<Awaited<ReturnType<BunkerGameService["getRoomWithState"]>>>;
    perSession: (sessionId: string) => BunkerPublicState;
  }> {
    const room = await this.getRoomWithState(code);
    if (!room || !room.bunkerGame) {
      throw new Error("Room state topilmadi.");
    }
    const [cardTranslations, cardTags] = await Promise.all([
      this.loadCardTranslations(),
      this.loadCardTagsMap()
    ]);
    const chatMessages = await chatService.getRecentMessages(room.code);
    const governance = await onlineGovernanceService.getState(room.code);
    return {
      room,
      perSession: (sessionId: string) =>
        this.buildRoomState(
          room,
          sessionId,
          cardTranslations,
          cardTags,
          chatMessages,
          governance
        )
    };
  }

  private buildRoomState(
    room: NonNullable<Awaited<ReturnType<BunkerGameService["getRoomWithState"]>>>,
    sessionId: string,
    cardTranslations: CardTranslationMap,
    cardTags: CardTagsMap,
    chatMessages: Awaited<ReturnType<typeof chatService.getRecentMessages>>,
    governance: Awaited<ReturnType<typeof onlineGovernanceService.getState>>
  ): BunkerPublicState {
    if (!room.bunkerGame) {
      throw new Error("Room state topilmadi.");
    }
    const me = room.players.find((player) => player.sessionId === sessionId) ?? null;
    const remainingSeconds = this.getRemainingSeconds(room.bunkerGame.timerEndsAt);
    const currentRoundNumber = room.bunkerGame.roundNumber;

    return {
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        round: room.round,
        winnerTarget: room.winnerTarget,
        maxPlayers: room.maxPlayers,
        isAdult: room.isAdult,
      },
      game: {
        phase: room.bunkerGame.phase,
        roundNumber: room.bunkerGame.roundNumber,
        timerEndsAt: room.bunkerGame.timerEndsAt ? room.bunkerGame.timerEndsAt.toISOString() : null,
        remainingSeconds,
        currentTurnPlayerId: room.bunkerGame.currentTurnPlayerId,
        lastRevealedPlayerId: room.bunkerGame.lastRevealedPlayerId,
        lastRevealedCardType: room.bunkerGame.lastRevealedCardType,
        lastEliminatedPlayerId: room.bunkerGame.lastEliminatedPlayerId,
        tiebreakCandidateIds: room.bunkerGame.tiebreakCandidateIds,
        disaster: room.bunkerGame.disaster
          ? {
              id: room.bunkerGame.disaster.id,
              name: buildLocalizedText(
                room.bunkerGame.disaster.name,
                room.bunkerGame.disaster.nameRu,
                room.bunkerGame.disaster.nameEn
              ),
              description: buildLocalizedText(
                room.bunkerGame.disaster.description,
                room.bunkerGame.disaster.descriptionRu,
                room.bunkerGame.disaster.descriptionEn
              )
            }
          : null,
        situation: room.bunkerGame.currentSituation
          ? {
              id: room.bunkerGame.currentSituation.id,
              text: buildLocalizedText(
                room.bunkerGame.currentSituation.text,
                room.bunkerGame.currentSituation.textRu,
                room.bunkerGame.currentSituation.textEn
              ),
              difficulty: room.bunkerGame.currentSituation.difficulty,
              tier: room.bunkerGame.currentSituation.tier,
              highlightTags: room.bunkerGame.currentSituation.highlightTags,
              weakTags: room.bunkerGame.currentSituation.weakTags,
              voteReason: room.bunkerGame.currentSituation.voteReason
                ? buildLocalizedText(
                    room.bunkerGame.currentSituation.voteReason,
                    room.bunkerGame.currentSituation.voteReasonRu,
                    room.bunkerGame.currentSituation.voteReasonEn
                  )
                : null
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
            cards: this.extractCards(me.bunkerAttributes, cardTranslations),
            cardTags: this.extractCardTags(me.bunkerAttributes, cardTags),
            revealed: me.bunkerAttributes?.revealed ?? []
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
        const revealedTags = this.extractRevealedCardTags(
          player.bunkerAttributes,
          cardTags
        );
        const situation = room.bunkerGame?.currentSituation ?? null;
        const badge = situation
          ? this.computeSituationBadge(
              revealedTags,
              situation.highlightTags,
              situation.weakTags
            )
          : "neutral";
        return {
          id: player.id,
          name: player.name,
          isHost: player.isHost,
          isAlive: player.isAlive,
          readyAt: player.readyAt ? player.readyAt.toISOString() : null,
          online: isOnline,
          seatOrder: player.seatOrder,
          visibleCards: showAll
            ? this.extractCards(player.bunkerAttributes, cardTranslations)
            : this.extractRevealedCards(player.bunkerAttributes, cardTranslations),
          revealedCards: this.extractRevealedCards(
            player.bunkerAttributes,
            cardTranslations
          ),
          revealedCardTags: revealedTags,
          revealedCount: player.bunkerAttributes?.revealed.length ?? 0,
          situationBadge: badge
        };
      }),
      votes: {
        total: room.bunkerVotes.filter((vote) => vote.roundNumber === currentRoundNumber).length,
        submittedByMe: me
          ? room.bunkerVotes.some(
              (vote) => vote.roundNumber === currentRoundNumber && vote.voterPlayerId === me.id
            )
          : false,
        elimsThisRound:
          room.bunkerGame?.tiebreakCandidateIds.length
            ? 1
            : isSelfManagedOnlineRoom(room.mode)
              ? getBunkerEliminationsForRound(
                  room.players.length,
                  room.winnerTarget,
                  currentRoundNumber
                )
              : 1
      },
      chat: {
        messages: chatMessages
      },
      governance
    };
  }

  async startGame(input: RoomCodeAction) {
    return withRoomActionLock(input.code, () => this.startGameUnlocked(input));
  }

  private async startGameUnlocked(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (room.players.length < 3) {
      throw new Error("O'yinni boshlash uchun kamida 3 o'yinchi kerak.");
    }

    if (room.mode === "ONLINE") {
      const { winnerTarget } = await applyOnlineBunkerComposition({
        roomId: room.id,
        playerCount: room.players.length
      });
      room.winnerTarget = winnerTarget;
    }

    // 18+ rooms can pull from both pools (more variety); normal rooms
    // only see family-friendly content. Filter at the source so admins
    // can flip a single flag and have it propagate everywhere.
    const adultFilter = room.isAdult ? {} : { isAdult: false };
    const [disasters, cards] = await Promise.all([
      prisma.bunkerDisaster.findMany({ where: adultFilter }),
      prisma.bunkerCard.findMany({
        where: adultFilter,
        select: { id: true, type: true, text: true, isAdult: true, tags: true }
      })
    ]);

    if (!disasters.length || !cards.length) {
      throw new Error("Seed ma'lumotlari topilmadi.");
    }

    // Disaster cooldown: avoid back-to-back repeats for THIS host. Falls
    // back to the full pool if cooldown filtered everyone out.
    const hostKey = this.hostCooldownKey(room);
    const selectedDisaster = (() => {
      const recent = BunkerGameService.cooldownActive(
        BunkerGameService.recentDisasters,
        hostKey,
        BunkerGameService.RECENT_DISASTER_TTL_MS
      );
      const fresh = disasters.filter((d) => !recent.has(d.id));
      const pool = fresh.length > 0 ? fresh : disasters;
      const picked = pool[randomInt(pool.length)];
      BunkerGameService.cooldownAdd(BunkerGameService.recentDisasters, hostKey, [
        picked.id
      ]);
      return picked;
    })();
    const introEndsAt = new Date(
      Date.now() + getBunkerIntroDurationSeconds(room.mode) * 1000
    );

    // Deal a unique card per player for every type. Each player has their
    // own personal cooldown (last 2h of cards they were dealt), so
    // back-to-back games avoid repeating cards for the SAME player even if
    // a different host runs the next room. 18+ rooms guarantee at least
    // one adult card per hand.
    const dealPlayers = room.players.map((p) => ({
      userKey: p.userId ?? `session:${p.sessionId}`
    }));
    const deal = this.buildUniqueDeal(cards, dealPlayers, {
      adultMode: !!room.isAdult,
      disasterTags: [
        ...(selectedDisaster.usefulTags ?? []),
        ...(selectedDisaster.vulnerableTags ?? [])
      ]
    });

    await prisma.$transaction(async (tx) => {
      if (room.bunkerGame) {
        await tx.bunkerVote.deleteMany({ where: { roomId: room.id } });
        await tx.bunkerPlayerAttribute.deleteMany({ where: { gameId: room.bunkerGame.id } });
      }

      const startedAt = new Date();
      const game = room.bunkerGame
        ? await tx.bunkerGame.update({
            where: { id: room.bunkerGame.id },
            data: {
              disasterId: selectedDisaster.id,
              currentSituationId: null,
              phase: BunkerPhase.INTRO,
              timerEndsAt: introEndsAt,
              startedAt,
              roundNumber: 0,
              currentTurnPlayerId: null,
              lastRevealedPlayerId: null,
              lastRevealedCardType: null,
              lastEliminatedPlayerId: null
            }
          })
        : await tx.bunkerGame.create({
            data: {
              roomId: room.id,
              disasterId: selectedDisaster.id,
              phase: BunkerPhase.INTRO,
              timerEndsAt: introEndsAt,
              startedAt,
              roundNumber: 0
            }
          });

      for (let index = 0; index < room.players.length; index += 1) {
        const player = room.players[index];

        await tx.player.update({
          where: { id: player.id },
          data: { isAlive: true, readyAt: null }
        });

        await tx.bunkerPlayerAttribute.create({
          data: {
            playerId: player.id,
            gameId: game.id,
            profession: deal[BunkerCardType.PROFESSION][index],
            health: deal[BunkerCardType.HEALTH][index],
            character: deal[BunkerCardType.CHARACTER][index],
            skill: deal[BunkerCardType.SKILL][index],
            baggage: deal[BunkerCardType.BAGGAGE][index],
            fact: deal[BunkerCardType.FACT][index],
            revealed: [BunkerCardType.PROFESSION]
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

    await onlineGovernanceService.clearRoom(room.code);
    this.startTimer(room.code, introEndsAt);
  }

  async startRound(input: RoomCodeAction) {
    await this.requireHostRoom(input);
    await this.beginNextRound(input.code);
  }

  async toggleReady(input: RoomCodeAction) {
    return withRoomActionLock(input.code, async () => {
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
      if (room.mode !== "ONLINE") {
        throw new Error("Tayyorman faqat online lobby uchun ishlaydi.");
      }
      if (room.status !== RoomStatus.LOBBY) {
        throw new Error("O'yin boshlanganidan keyin tayyor holatini o'zgartirib bo'lmaydi.");
      }

      const me = room.players.find((player) => player.sessionId === input.sessionId);
      if (!me) {
        throw new Error("O'yinchi topilmadi.");
      }
      if (room.players.length < BUNKER_ONLINE_MIN_PLAYERS && !me.readyAt) {
        throw new Error("Kamida 3 o'yinchi bo'lgach tayyor holatini yoqish mumkin.");
      }

      const nextReadyAt = me.readyAt ? null : new Date();

      await prisma.player.update({
        where: { id: me.id },
        data: { readyAt: nextReadyAt }
      });

      if (!nextReadyAt) {
        return;
      }

      const refreshed = await prisma.room.findUnique({
        where: { id: room.id },
        include: {
          players: {
            orderBy: { seatOrder: "asc" }
          }
        }
      });

      if (
        refreshed &&
        shouldAutoStartOnlineLobby(refreshed.players, BUNKER_ONLINE_MIN_PLAYERS)
      ) {
        await this.startGameUnlocked({
          code: refreshed.code,
          sessionId: refreshed.hostSessionId
        });
      }
    });
  }

  async advanceTurn(input: RoomCodeAction) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: { bunkerGame: true, players: true }
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
      room.bunkerGame?.phase === BunkerPhase.ROUND_PITCH &&
      room.bunkerGame.currentTurnPlayerId === me.id;

    if (!me.isHost && !isCurrentPitcher) {
      throw new Error("Bu amal faqat host yoki pitch qilayotgan o'yinchi uchun.");
    }

    await this.advanceTurnForRoom(input.code);
  }

  async startVoting(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (!room.bunkerGame || room.bunkerGame.phase !== BunkerPhase.ROUND_COMPLETE) {
      throw new Error("Hozir voting boshlash mumkin emas.");
    }

    const votingEndsAt = new Date(
      Date.now() + BUNKER_VOTING_DURATION_SECONDS * 1000
    );
    await prisma.$transaction([
      prisma.bunkerVote.deleteMany({
        where: {
          roomId: room.id,
          roundNumber: room.bunkerGame.roundNumber
        }
      }),
      prisma.bunkerGame.update({
        where: { id: room.bunkerGame.id },
        data: {
          phase: BunkerPhase.VOTING,
          timerEndsAt: votingEndsAt,
          currentTurnPlayerId: null,
          tiebreakCandidateIds: []
        }
      })
    ]);

    this.startTimer(room.code, votingEndsAt);
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
    const me = room.players.find((p) => p.sessionId === input.sessionId);
    if (!me) throw new Error("O'yinchi topilmadi.");
    if (room.status !== RoomStatus.LOBBY) {
      if (room.mode !== "ONLINE") {
        throw new Error("O'yin boshlanganidan keyin chiqib bo'lmaydi.");
      }
      await this.removePlayerFromOnlineGame(room.code, me.id, input.sessionId);
      return;
    }
    if (me.isHost) {
      if (room.mode === "ONLINE") {
        const transfer = await hostTransferService.transferOnlineRoomHost({
          roomCode: room.code,
          expectedHostSessionId: input.sessionId,
          currentHostPlayerId: me.id
        });

        if (transfer?.kind === "transferred") {
          await prisma.player.delete({ where: { id: me.id } });
          await onlineGovernanceService.clearRoom(room.code);
          return {
            creatorChanged: {
              roomCode: transfer.roomCode,
              previousHostSessionId: transfer.previousHostSessionId,
              nextHostSessionId: transfer.nextHostSessionId,
              nextHostPlayerId: transfer.nextHostPlayerId
            }
          };
        }

        await prisma.$transaction([
          prisma.player.delete({ where: { id: me.id } }),
          prisma.room.update({
            where: { id: room.id },
            data: { status: RoomStatus.CANCELLED }
          })
        ]);
        await onlineGovernanceService.clearRoom(room.code);
        return;
      }
      throw new Error("Host xonadan chiqa olmaydi. O'yinni tugating yoki bekor qiling.");
    }
    await prisma.player.delete({ where: { id: me.id } });
    if (room.mode === "ONLINE") {
      await onlineGovernanceService.clearRoom(room.code);
    }
  }

  private async removePlayerFromOnlineGame(
    roomCode: string,
    playerId: string,
    sessionId: string
  ) {
    const room = await this.getRoomWithState(roomCode);
    if (!room || !room.bunkerGame) throw new Error("Room topilmadi.");

    const target = room.players.find((player) => player.id === playerId);
    if (!target) throw new Error("O'yinchi topilmadi.");

    if (target.isHost) {
      const transfer = await hostTransferService.transferOnlineRoomHost({
        roomCode: room.code,
        expectedHostSessionId: sessionId,
        currentHostPlayerId: target.id
      });

      if (transfer?.kind !== "transferred" && room.players.length <= 1) {
        await this.endGame({ code: room.code, sessionId });
        return;
      }
    }

    if (!target.isAlive) {
      throw new Error("Bu o'yinchi allaqachon chiqib ketgan.");
    }

    const targetAttributes = await prisma.bunkerPlayerAttribute.findUnique({
      where: { playerId: target.id }
    });
    const wasCurrentTurn = room.bunkerGame.currentTurnPlayerId === target.id;
    const gameId = room.bunkerGame.id;
    const roomId = room.id;

    let didFinish = false;

    await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: target.id },
        data: { isAlive: false }
      });
      if (targetAttributes) {
        await tx.bunkerPlayerAttribute.update({
          where: { id: targetAttributes.id },
          data: { revealed: CARD_TYPES.slice() as BunkerCardType[] }
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
        await tx.bunkerGame.update({
          where: { id: gameId },
          data: {
            phase: BunkerPhase.FINISHED,
            timerEndsAt: null,
            currentTurnPlayerId: null,
            lastEliminatedPlayerId: target.id,
            tiebreakCandidateIds: []
          }
        });
        didFinish = true;
        return;
      }

      await tx.bunkerGame.update({
        where: { id: gameId },
        data: {
          lastEliminatedPlayerId: target.id,
          ...(wasCurrentTurn ? { currentTurnPlayerId: null } : {})
        }
      });
    });

    if (didFinish) {
      this.stopTimer(room.code);
      await onlineGovernanceService.clearRoom(room.code);
      await this.saveGameHistory(roomId, "manualEnd");
      return;
    }

    if (wasCurrentTurn) {
      await this.advanceTurnForRoom(room.code);
    }
    await onlineGovernanceService.clearRoom(room.code);
  }

  async kickPlayer(input: RoomCodeAction & { targetPlayerId: string }) {
    const room = await this.requireHostRoom(input);

    if (!room.bunkerGame) {
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

    const targetAttributes = await prisma.bunkerPlayerAttribute.findUnique({
      where: { playerId: target.id }
    });
    const wasCurrentTurn = room.bunkerGame.currentTurnPlayerId === target.id;
    const gameId = room.bunkerGame.id;
    const roomId = room.id;

    let didFinish = false;

    await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: target.id },
        data: { isAlive: false }
      });
      if (targetAttributes) {
        await tx.bunkerPlayerAttribute.update({
          where: { id: targetAttributes.id },
          data: { revealed: CARD_TYPES.slice() as BunkerCardType[] }
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
        await tx.bunkerGame.update({
          where: { id: gameId },
          data: {
            phase: BunkerPhase.FINISHED,
            timerEndsAt: null,
            currentTurnPlayerId: null,
            lastEliminatedPlayerId: target.id,
            tiebreakCandidateIds: []
          }
        });
        didFinish = true;
        return;
      }

      await tx.bunkerGame.update({
        where: { id: gameId },
        data: {
          lastEliminatedPlayerId: target.id,
          ...(wasCurrentTurn ? { currentTurnPlayerId: null } : {})
        }
      });
    });

    if (didFinish) {
      this.stopTimer(room.code);
      await onlineGovernanceService.clearRoom(room.code);
      await this.saveGameHistory(roomId, "manualEnd");
      return;
    }

    // If we just removed the player whose turn it was, push the round
    // forward so the game doesn't get stuck waiting on them.
    if (wasCurrentTurn) {
      await this.advanceTurnForRoom(room.code);
    }
    if (room.mode === "ONLINE") {
      await onlineGovernanceService.clearRoom(room.code);
    }
  }

  async endGame(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (!room.bunkerGame) {
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
      prisma.bunkerGame.update({
        where: { id: room.bunkerGame.id },
        data: {
          phase: BunkerPhase.FINISHED,
          timerEndsAt: null,
          currentTurnPlayerId: null
        }
      })
    ]);

    await this.saveGameHistory(room.id, wasInLobby ? "cancelled" : "manualEnd");
    await onlineGovernanceService.clearRoom(room.code);
  }

  private async saveGameHistory(
    roomId: string,
    kind: "natural" | "manualEnd" | "cancelled"
  ) {
    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          bunkerGame: { include: { disaster: true } },
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
      const startedAt = room.bunkerGame?.startedAt ?? null;
      const durationSeconds =
        startedAt && kind !== "cancelled"
          ? Math.max(
              0,
              Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
            )
          : null;

      const disaster = room.bunkerGame?.disaster;
      await prisma.gameHistory.create({
        data: {
          userId: room.hostUserId,
          gameType: GameType.BUNKER,
          playedAt: endedAt,
          startedAt,
          endedAt: kind === "cancelled" ? null : endedAt,
          durationSeconds,
          outcome,
          visibility: room.visibility,
          roomCode: room.code,
          playerCount: room.players.length,
          metadata: disaster
            ? {
                disasterName: disaster.name,
                disasterNameI18n: buildLocalizedText(
                  disaster.name,
                  disaster.nameRu,
                  disaster.nameEn
                )
              }
            : Prisma.JsonNull
        }
      });
    } catch (error) {
      console.error("saveGameHistory failed", error);
    }
  }

  async nextPhase(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);

    if (!room.bunkerGame) {
      throw new Error("O'yin state topilmadi.");
    }

    if (room.bunkerGame.phase === BunkerPhase.INTRO || room.bunkerGame.phase === BunkerPhase.ROUND_COMPLETE) {
      await this.beginNextRound(room.code);
      return;
    }

    if (room.bunkerGame.phase === BunkerPhase.ROUND_PITCH) {
      await this.advanceTurnForRoom(room.code);
      return;
    }

    if (room.bunkerGame.phase === BunkerPhase.VOTING) {
      await this.resolveVoting(room.code);
    }
  }

  async revealCard(input: RevealInput) {
    const room = await this.getRoomWithState(input.code);

    if (!room?.bunkerGame) {
      throw new Error("Room topilmadi.");
    }

    if (room.bunkerGame.phase !== BunkerPhase.ROUND_REVEAL) {
      throw new Error("Hozir kartani ochish bosqichi emas.");
    }

    const me = room.players.find((player) => player.sessionId === input.sessionId);

    if (!me || !me.bunkerAttributes || !me.isAlive) {
      throw new Error("Kartani ochish uchun aktiv o'yinchi bo'lish kerak.");
    }

    if (room.bunkerGame.currentTurnPlayerId !== me.id) {
      throw new Error("Hozir navbat sizda emas.");
    }

    if (input.cardType === BunkerCardType.PROFESSION) {
      throw new Error("Kasb kartasi avtomatik ochilgan.");
    }

    if (me.bunkerAttributes.revealed.includes(input.cardType)) {
      throw new Error("Bu karta allaqachon ochilgan.");
    }

    const pitchEndsAt = new Date(
      Date.now() + BUNKER_PITCH_DURATION_SECONDS * 1000
    );
    await prisma.$transaction([
      prisma.bunkerPlayerAttribute.update({
        where: { id: me.bunkerAttributes.id },
        data: {
          revealed: [...me.bunkerAttributes.revealed, input.cardType]
        }
      }),
      prisma.bunkerGame.update({
        where: { id: room.bunkerGame.id },
        data: {
          phase: BunkerPhase.ROUND_PITCH,
          timerEndsAt: pitchEndsAt,
          lastRevealedPlayerId: me.id,
          lastRevealedCardType: input.cardType
        }
      })
    ]);

    this.startTimer(room.code, pitchEndsAt);
  }

  async submitVote(input: VoteInput) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: {
        bunkerGame: true,
        players: true
      }
    });

    if (!room || !room.bunkerGame) {
      throw new Error("Room topilmadi.");
    }

    if (room.bunkerGame.phase !== BunkerPhase.VOTING) {
      throw new Error("Hozir voting bosqichi emas.");
    }

    const me = room.players.find((player) => player.sessionId === input.sessionId);
    if (!me || !me.isAlive) {
      throw new Error("Faqat tirik o'yinchi ovoz bera oladi.");
    }

    // Deduplicate targets up front so a client double-tap can't inflate counts.
    const targetIds = Array.from(new Set(input.targetPlayerIds));
    if (!targetIds.length) {
      throw new Error("Kamida bitta nomzod tanlang.");
    }
    if (targetIds.includes(me.id)) {
      throw new Error("O'zingizga ovoz bera olmaysiz.");
    }
    const targets = targetIds.map((id) =>
      room.players.find((player) => player.id === id)
    );
    if (targets.some((t) => !t || !t.isAlive)) {
      throw new Error("Noto'g'ri target tanlandi.");
    }

    const tiebreakCandidates = room.bunkerGame.tiebreakCandidateIds;
    const tiebreakActive = tiebreakCandidates.length > 0;
    const alivePlayers = room.players.filter((player) => player.isAlive);
    const allAliveAreTied =
      tiebreakActive &&
      alivePlayers.length > 0 &&
      alivePlayers.every((player) => tiebreakCandidates.includes(player.id));

    // Tiebreak rounds always pick exactly one — only the missing seat from a
    // prior round is at stake.
    const expectedTargets = tiebreakActive
      ? 1
      : isSelfManagedOnlineRoom(room.mode)
        ? Math.max(
            1,
            getBunkerEliminationsForRound(
              room.players.length,
              room.winnerTarget,
              room.bunkerGame.roundNumber
            )
          )
        : 1;

    if (targetIds.length !== expectedTargets) {
      throw new Error(
        `Bu round'da aynan ${expectedTargets} ta nomzod tanlash kerak.`
      );
    }

    if (tiebreakActive) {
      if (tiebreakCandidates.includes(me.id) && !allAliveAreTied) {
        throw new Error("Tenglikdagi nomzodlar ovoz bera olmaydi.");
      }
      if (!tiebreakCandidates.includes(targetIds[0])) {
        throw new Error("Faqat tenglikdagi nomzodlardan birini tanlang.");
      }
    }

    // Replace the voter's whole ballot for this round so that re-submitting
    // is idempotent — the unique key is now (room, round, voter, target), so
    // a stale row from an earlier ballot would otherwise survive.
    await prisma.$transaction([
      prisma.bunkerVote.deleteMany({
        where: {
          roomId: room.id,
          roundNumber: room.bunkerGame.roundNumber,
          voterPlayerId: me.id
        }
      }),
      prisma.bunkerVote.createMany({
        data: targetIds.map((targetPlayerId) => ({
          roomId: room.id,
          roundNumber: room.bunkerGame!.roundNumber,
          voterPlayerId: me.id,
          targetPlayerId
        }))
      })
    ]);

    const expectedVoters = tiebreakActive
      ? allAliveAreTied
        ? alivePlayers.length
        : alivePlayers.filter((p) => !tiebreakCandidates.includes(p.id)).length
      : alivePlayers.length;
    const distinctVoters = await prisma.bunkerVote.findMany({
      where: {
        roomId: room.id,
        roundNumber: room.bunkerGame.roundNumber
      },
      distinct: ["voterPlayerId"],
      select: { voterPlayerId: true }
    });

    if (distinctVoters.length >= expectedVoters) {
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

  // On server boot, restart timers for every PLAYING room. Without this,
  // a deploy / crash mid-round leaves the phase frozen (timerEndsAt in
  // the past, no interval ticking) so resolveVoting / advanceTurn never
  // fires and the client sees a hung "Ovoz berish" sheet. We treat each
  // bucket as either:
  //   • already past → fire the same resolution the tick would have, then
  //     broadcast (catches up missed deadlines);
  //   • still in the future → start a fresh interval pointing at the
  //     persisted endsAt.
  // Called from index.ts after RealtimeHub is wired in.
  async resumeTimers() {
    const rooms = await prisma.room.findMany({
      where: {
        status: RoomStatus.PLAYING,
        bunkerGame: { timerEndsAt: { not: null } }
      },
      select: { code: true, bunkerGame: { select: { phase: true, timerEndsAt: true } } }
    });

    for (const room of rooms) {
      const endsAt = room.bunkerGame?.timerEndsAt;
      const phase = room.bunkerGame?.phase;
      if (!endsAt || !phase) continue;

      if (endsAt.getTime() <= Date.now()) {
        try {
          if (phase === BunkerPhase.INTRO) {
            await this.beginNextRound(room.code);
          } else if (phase === BunkerPhase.ROUND_REVEAL) {
            await this.autoRevealCurrentTurn(room.code);
          } else if (phase === BunkerPhase.ROUND_PITCH) {
            await this.advanceTurnForRoom(room.code);
          } else if (phase === BunkerPhase.VOTING) {
            await this.resolveVoting(room.code);
          } else if (phase === BunkerPhase.ROUND_COMPLETE) {
            await this.beginNextRound(room.code);
          }
          await this.realtime.broadcastRoomState(room.code);
        } catch (error) {
          console.error(`bunker resumeTimers failed for ${room.code}`, error);
        }
      } else {
        this.startTimer(room.code, endsAt);
      }
    }
  }

  private async requireHostRoom(input: RoomCodeAction) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: {
        bunkerGame: true,
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

    if (!room?.bunkerGame) {
      throw new Error("Room topilmadi.");
    }

    if (
      room.bunkerGame.phase !== BunkerPhase.INTRO &&
      room.bunkerGame.phase !== BunkerPhase.ROUND_COMPLETE
    ) {
      throw new Error("Hozir yangi round boshlash mumkin emas.");
    }

    const nextRound = room.round + 1;
    const currentDisaster = room.bunkerGame.disasterId
      ? await prisma.bunkerDisaster.findUnique({
          where: { id: room.bunkerGame.disasterId },
          select: { key: true }
        })
      : null;
    const nextSituation = await this.pickSituation({
      excludeId: room.bunkerGame.currentSituationId ?? undefined,
      isAdult: room.isAdult,
      disasterKey: currentDisaster?.key ?? null,
      roundNumber: nextRound
    });

    const stillEligible = room.players.some(
      (player) =>
        player.isAlive &&
        player.bunkerAttributes &&
        (player.bunkerAttributes.revealed.length ?? 0) < nextRound + 1
    );

    if (!stillEligible) {
      throw new Error("Reveal uchun aktiv o'yinchi topilmadi.");
    }

    this.stopTimer(room.code);

    const nextRevealPlayer = this.findNextRevealPlayer(
      room.players,
      nextRound,
      null
    );

    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { round: nextRound }
      }),
      prisma.bunkerGame.update({
        where: { id: room.bunkerGame.id },
        data: {
          roundNumber: nextRound,
          currentSituationId: nextSituation.id,
          phase: BunkerPhase.ROUND_REVEAL,
          timerEndsAt:
            isSelfManagedOnlineRoom(room.mode)
              ? new Date(
                  Date.now() + (getBunkerRevealDurationSeconds(room.mode) ?? 0) * 1000
                )
              : null,
          currentTurnPlayerId:
            isSelfManagedOnlineRoom(room.mode) ? nextRevealPlayer?.id ?? null : null,
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

    if (!room?.bunkerGame) {
      throw new Error("Room topilmadi.");
    }

    if (room.bunkerGame.phase !== BunkerPhase.ROUND_REVEAL) {
      throw new Error("Hozir reveal bosqichi emas.");
    }

    if (room.bunkerGame.currentTurnPlayerId) {
      throw new Error("Reveal allaqachon boshlangan.");
    }

    const next = this.findNextRevealPlayer(
      room.players,
      room.bunkerGame.roundNumber,
      null
    );

    if (!next) {
      throw new Error("Reveal uchun aktiv o'yinchi topilmadi.");
    }

    const revealSeconds = getBunkerRevealDurationSeconds(room.mode);
    const revealEndsAt = revealSeconds
      ? new Date(Date.now() + revealSeconds * 1000)
      : null;
    await prisma.bunkerGame.update({
      where: { id: room.bunkerGame.id },
      data: {
        currentTurnPlayerId: next.id,
        timerEndsAt: revealEndsAt
      }
    });

    if (revealEndsAt) {
      this.startTimer(room.code, revealEndsAt);
    }
  }

  private async autoRevealCurrentTurn(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);

    if (!room?.bunkerGame) {
      throw new Error("Room topilmadi.");
    }
    const game = room.bunkerGame;
    if (game.phase !== BunkerPhase.ROUND_REVEAL) {
      return;
    }

    const currentPlayer = room.players.find(
      (player) => player.id === game.currentTurnPlayerId
    );
    if (!currentPlayer?.bunkerAttributes) {
      await this.advanceTurnForRoom(roomCode);
      return;
    }

    const availableCards = CARD_TYPES.filter(
      (cardType) =>
        cardType !== BunkerCardType.PROFESSION &&
        !currentPlayer.bunkerAttributes?.revealed.includes(cardType)
    );

    if (availableCards.length === 0) {
      await this.advanceTurnForRoom(roomCode);
      return;
    }

    const randomCardType = availableCards[randomInt(availableCards.length)];

    const pitchEndsAt = new Date(
      Date.now() + BUNKER_PITCH_DURATION_SECONDS * 1000
    );
    await prisma.$transaction([
      prisma.bunkerPlayerAttribute.update({
        where: { id: currentPlayer.bunkerAttributes.id },
        data: {
          revealed: [...currentPlayer.bunkerAttributes.revealed, randomCardType]
        }
      }),
      prisma.bunkerGame.update({
        where: { id: game.id },
        data: {
          phase: BunkerPhase.ROUND_PITCH,
          timerEndsAt: pitchEndsAt,
          lastRevealedPlayerId: currentPlayer.id,
          lastRevealedCardType: randomCardType
        }
      })
    ]);

    this.startTimer(room.code, pitchEndsAt);
  }

  private async advanceTurnForRoom(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);

    if (!room?.bunkerGame) {
      throw new Error("Room topilmadi.");
    }

    if (
      room.bunkerGame.phase !== BunkerPhase.ROUND_PITCH &&
      room.bunkerGame.phase !== BunkerPhase.ROUND_REVEAL
    ) {
      throw new Error("Hozir keyingi o'yinchiga o'tish mumkin emas.");
    }

    const nextTurn = this.findNextRevealPlayer(
      room.players,
      room.bunkerGame.roundNumber,
      room.bunkerGame.currentTurnPlayerId
    );

    this.stopTimer(room.code);

    // After the last reveal of the round, online rooms either jump straight to
    // voting (if eliminations are scheduled) or skip voting entirely for
    // story-only rounds (early rounds in small games where the schedule has
    // a 0). Friends rooms always pause at ROUND_COMPLETE for the host.
    const onlineSkipsVoting =
      !nextTurn &&
      isSelfManagedOnlineRoom(room.mode) &&
      getBunkerEliminationsForRound(
        room.players.length,
        room.winnerTarget,
        room.bunkerGame.roundNumber
      ) === 0;

    const revealSeconds = getBunkerRevealDurationSeconds(room.mode);
    const roundResultSeconds = getBunkerRoundResultDurationSeconds(room.mode);
    const nextRevealEndsAt =
      nextTurn && revealSeconds
        ? new Date(Date.now() + revealSeconds * 1000)
        : null;
    const skipVotingEndsAt =
      !nextTurn && onlineSkipsVoting && roundResultSeconds
        ? new Date(Date.now() + roundResultSeconds * 1000)
        : null;
    const votingEndsAt =
      !nextTurn && !onlineSkipsVoting && isSelfManagedOnlineRoom(room.mode)
        ? new Date(Date.now() + BUNKER_VOTING_DURATION_SECONDS * 1000)
        : null;
    await prisma.bunkerGame.update({
      where: { id: room.bunkerGame.id },
      data: nextTurn
        ? {
            phase: BunkerPhase.ROUND_REVEAL,
            timerEndsAt: nextRevealEndsAt,
            currentTurnPlayerId: nextTurn.id
          }
        : onlineSkipsVoting
          ? {
              phase: BunkerPhase.ROUND_COMPLETE,
              timerEndsAt: skipVotingEndsAt,
              currentTurnPlayerId: null,
              tiebreakCandidateIds: []
            }
          : isSelfManagedOnlineRoom(room.mode)
            ? {
                phase: BunkerPhase.VOTING,
                timerEndsAt: votingEndsAt,
                currentTurnPlayerId: null,
                tiebreakCandidateIds: []
              }
            : {
                phase: BunkerPhase.ROUND_COMPLETE,
                timerEndsAt: null,
                currentTurnPlayerId: null
              }
    });

    if (nextTurn && nextRevealEndsAt) {
      this.startTimer(room.code, nextRevealEndsAt);
    } else if (!nextTurn && onlineSkipsVoting && skipVotingEndsAt) {
      this.startTimer(room.code, skipVotingEndsAt);
    } else if (!nextTurn && isSelfManagedOnlineRoom(room.mode) && votingEndsAt) {
      this.startTimer(room.code, votingEndsAt);
    }
  }

  private async resolveVoting(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);

    if (!room || !room.bunkerGame) {
      throw new Error("Room topilmadi.");
    }

    const currentRoundVotes = room.bunkerVotes.filter(
      (vote) => vote.roundNumber === room.bunkerGame?.roundNumber
    );

    const aliveBeforeVote = room.players.filter((p) => p.isAlive);
    const isEndgame = aliveBeforeVote.length <= room.winnerTarget + 1;
    const tiebreakActive = room.bunkerGame.tiebreakCandidateIds.length > 0;

    // How many players this round is supposed to eliminate. Online rooms get
    // it from the back-loaded schedule; friends and any tiebreak round eliminate
    // exactly one. Capped to alive-1 so we never empty the lobby in one go.
    const scheduledElims = tiebreakActive
      ? 1
      : isSelfManagedOnlineRoom(room.mode)
        ? getBunkerEliminationsForRound(
            room.players.length,
            room.winnerTarget,
            room.bunkerGame.roundNumber
          )
        : 1;
    const maxAllowedElims = Math.max(0, aliveBeforeVote.length - room.winnerTarget);
    const elimsThisRound = Math.min(scheduledElims, maxAllowedElims);

    let eliminatedIds: string[] = [];

    if (!currentRoundVotes.length) {
      // No votes — at endgame we must force progress (2 players refusing to
      // vote against each other would otherwise loop forever). Otherwise let
      // the round end without elimination.
      if (!isEndgame) {
        const roundResultDelaySeconds = getBunkerRoundResultDurationSeconds(room.mode);
        const roundResultEndsAt = roundResultDelaySeconds
          ? new Date(Date.now() + roundResultDelaySeconds * 1000)
          : null;
        await prisma.bunkerGame.update({
          where: { id: room.bunkerGame.id },
          data: {
            phase: BunkerPhase.ROUND_COMPLETE,
            timerEndsAt: roundResultEndsAt,
            tiebreakCandidateIds: []
          }
        });
        if (roundResultEndsAt) {
          this.startTimer(room.code, roundResultEndsAt);
        } else {
          this.stopTimer(room.code);
        }
        return;
      }

      eliminatedIds = [aliveBeforeVote[randomInt(aliveBeforeVote.length)].id];
    } else {
      const score = new Map<string, number>();
      for (const vote of currentRoundVotes) {
        score.set(
          vote.targetPlayerId,
          (score.get(vote.targetPlayerId) ?? 0) + 1
        );
      }

      // Single-elim rounds preserve the existing tiebreak phase so two-player
      // showdowns still play out fairly. Multi-elim rounds walk the scored
      // list top-to-bottom and accept clear-tier groups whole; if a tier
      // would overflow the remaining slot count, we break ties uniformly at
      // random rather than running another voting pass.
      if (elimsThisRound <= 1) {
        const topScore = Math.max(...score.values());
        const candidates = [...score.entries()]
          .filter(([, value]) => value === topScore)
          .map(([playerId]) => playerId);

        if (candidates.length > 1) {
          const eligibleVoters = aliveBeforeVote.filter(
            (p) => !candidates.includes(p.id)
          );
          const allAliveAreTied = candidates.length === aliveBeforeVote.length;

          if (eligibleVoters.length > 0 || (!tiebreakActive && allAliveAreTied)) {
            this.stopTimer(room.code);
            const tiebreakEndsAt = new Date(
              Date.now() + BUNKER_VOTING_DURATION_SECONDS * 1000
            );
            await prisma.$transaction([
              prisma.bunkerVote.deleteMany({
                where: {
                  roomId: room.id,
                  roundNumber: room.bunkerGame.roundNumber
                }
              }),
              prisma.bunkerGame.update({
                where: { id: room.bunkerGame.id },
                data: {
                  phase: BunkerPhase.VOTING,
                  timerEndsAt: tiebreakEndsAt,
                  tiebreakCandidateIds: candidates
                }
              })
            ]);
            this.startTimer(room.code, tiebreakEndsAt);
            return;
          }

          eliminatedIds = [candidates[randomInt(candidates.length)]];
        } else {
          eliminatedIds = [candidates[0]];
        }
      } else {
        const tiers = [...score.entries()].sort((a, b) => b[1] - a[1]);
        const chosen: string[] = [];
        let i = 0;
        while (i < tiers.length && chosen.length < elimsThisRound) {
          const tierScore = tiers[i][1];
          const tied: string[] = [];
          while (i < tiers.length && tiers[i][1] === tierScore) {
            tied.push(tiers[i][0]);
            i += 1;
          }
          const remainingSlots = elimsThisRound - chosen.length;
          if (tied.length <= remainingSlots) {
            chosen.push(...tied);
          } else {
            // Boundary tie — pick `remainingSlots` from the tied set uniformly.
            // Fisher–Yates shuffle keyed by crypto.randomInt for fairness.
            const shuffled = tied.slice();
            for (let j = shuffled.length - 1; j > 0; j -= 1) {
              const k = randomInt(j + 1);
              [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
            }
            chosen.push(...shuffled.slice(0, remainingSlots));
          }
        }
        eliminatedIds = chosen;
      }
    }

    const eliminatedPlayers = room.players.filter((player) =>
      eliminatedIds.includes(player.id)
    );
    const gameId = room.bunkerGame.id;
    const lastEliminatedId = eliminatedIds[eliminatedIds.length - 1] ?? null;

    this.stopTimer(room.code);

    const roundResultSecondsForElim = getBunkerRoundResultDurationSeconds(room.mode);
    const roundCompleteEndsAt = roundResultSecondsForElim
      ? new Date(Date.now() + roundResultSecondsForElim * 1000)
      : null;

    let didFinish = false;

    await prisma.$transaction(async (tx) => {
      if (eliminatedIds.length) {
        await tx.player.updateMany({
          where: { id: { in: eliminatedIds } },
          data: { isAlive: false }
        });
        for (const player of eliminatedPlayers) {
          if (player.bunkerAttributes) {
            await tx.bunkerPlayerAttribute.update({
              where: { id: player.bunkerAttributes.id },
              data: { revealed: CARD_TYPES.slice() as BunkerCardType[] }
            });
          }
        }
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
        await tx.bunkerGame.update({
          where: { id: gameId },
          data: {
            phase: BunkerPhase.FINISHED,
            timerEndsAt: null,
            currentTurnPlayerId: null,
            lastEliminatedPlayerId: lastEliminatedId,
            tiebreakCandidateIds: []
          }
        });
        didFinish = true;
        return;
      }

      await tx.bunkerGame.update({
        where: { id: gameId },
        data: {
          phase: BunkerPhase.ROUND_COMPLETE,
          timerEndsAt: roundCompleteEndsAt,
          currentTurnPlayerId: null,
          lastEliminatedPlayerId: lastEliminatedId,
          tiebreakCandidateIds: []
        }
      });
    });

    if (didFinish) {
      await onlineGovernanceService.clearRoom(room.code);
      await this.saveGameHistory(room.id, "natural");
      return;
    }

    if (isSelfManagedOnlineRoom(room.mode) && roundCompleteEndsAt) {
      this.startTimer(room.code, roundCompleteEndsAt);
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
        player.bunkerAttributes &&
        player.id !== excludePlayerId &&
        (player.bunkerAttributes.revealed.length ?? 0) < targetRevealCount
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
            bunkerAttributes: true
          },
          orderBy: { seatOrder: "asc" }
        },
        bunkerGame: {
          include: {
            disaster: true,
            currentSituation: true
          }
        },
        bunkerVotes: true
      }
    });
  }

  private async loadCardTagsMap(): Promise<CardTagsMap> {
    const cards = await prisma.bunkerCard.findMany({
      select: { type: true, text: true, tags: true }
    });
    return new Map(
      cards.map((card) => [
        this.cardTranslationKey(card.type, card.text),
        card.tags
      ])
    );
  }

  private async loadCardTranslations(): Promise<CardTranslationMap> {
    const cards = await prisma.bunkerCard.findMany({
      select: {
        type: true,
        text: true,
        textRu: true,
        textEn: true
      }
    });

    return new Map(
      cards.map((card) => [
        this.cardTranslationKey(card.type, card.text),
        buildLocalizedText(card.text, card.textRu, card.textEn)
      ])
    );
  }

  private async pickSituation(opts: {
    excludeId?: string;
    isAdult: boolean;
    disasterKey?: string | null;
    roundNumber: number;
  }) {
    const where: { id?: { not: string }; isAdult?: false } = {};
    if (opts.excludeId) where.id = { not: opts.excludeId };
    if (!opts.isAdult) where.isAdult = false;
    const all = await prisma.bunkerSituation.findMany({ where });

    if (!all.length) {
      throw new Error("Situation ma'lumotlari topilmadi.");
    }

    // Tier filter — only show situations whose tier <= current round.
    // Untagged tier (legacy/null) is always allowed so older content still
    // works. Higher-tier situations are reserved for later rounds for
    // dramatic escalation.
    const tierMatches = (s: { tier: number | null }) =>
      s.tier == null || s.tier <= opts.roundNumber;

    // Split pool: disaster-specific vs universal ("all"). 70/30 mix means
    // most prompts feel thematic but a universal one still surfaces
    // occasionally. If either bucket is empty we fall back to the other.
    const disasterKey = opts.disasterKey ?? null;
    const matchesDisaster = (s: { disasterTags: string[] }) =>
      disasterKey != null && s.disasterTags.includes(disasterKey);
    const matchesUniversal = (s: { disasterTags: string[] }) =>
      s.disasterTags.length === 0 || s.disasterTags.includes("all");

    const tierPool = all.filter(tierMatches);
    let disasterPool = tierPool.filter(matchesDisaster);
    let universalPool = tierPool.filter(
      (s) => matchesUniversal(s) && !matchesDisaster(s)
    );

    // If tier filter wiped everything, fall back to the unfiltered set so
    // the game never crashes mid-round just because content is thin.
    if (disasterPool.length === 0 && universalPool.length === 0) {
      disasterPool = all.filter(matchesDisaster);
      universalPool = all.filter(
        (s) => matchesUniversal(s) && !matchesDisaster(s)
      );
    }

    // Server-wide cooldown: filter recently-used out of each pool first.
    const now = Date.now();
    for (const [id, ts] of BunkerGameService.recentSituations) {
      if (now - ts > BunkerGameService.RECENT_SITUATION_TTL_MS) {
        BunkerGameService.recentSituations.delete(id);
      }
    }
    const filterFresh = <T extends { id: string }>(pool: T[]): T[] => {
      const fresh = pool.filter(
        (s) => !BunkerGameService.recentSituations.has(s.id)
      );
      return fresh.length > 0 ? fresh : pool;
    };
    disasterPool = filterFresh(disasterPool);
    universalPool = filterFresh(universalPool);

    // 70/30 mix; if one bucket is empty, draw entirely from the other.
    let pickedPool: typeof all;
    if (disasterPool.length === 0) pickedPool = universalPool;
    else if (universalPool.length === 0) pickedPool = disasterPool;
    else pickedPool = Math.random() < 0.7 ? disasterPool : universalPool;

    if (pickedPool.length === 0) {
      // Final safety net — should never trigger after the fallbacks above.
      pickedPool = all;
    }

    const picked = pickedPool[randomInt(pickedPool.length)];
    BunkerGameService.recentSituations.set(picked.id, now);
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

  // Sweep every bucket in every cooldown store, dropping entries past
  // their TTL and dropping empty buckets. Called from the periodic
  // cleanup sweeper so abandoned hosts/users don't pile up in memory.
  private static pruneCooldownStores(): void {
    const now = Date.now();
    const sweep = (
      store: Map<string, Map<string, number>>,
      ttlMs: number
    ): void => {
      for (const [hostKey, bucket] of store) {
        for (const [id, ts] of bucket) {
          if (now - ts > ttlMs) bucket.delete(id);
        }
        if (bucket.size === 0) store.delete(hostKey);
      }
    };
    sweep(BunkerGameService.recentCardsByUser, BunkerGameService.RECENT_CARD_TTL_MS);
    sweep(BunkerGameService.recentDisasters, BunkerGameService.RECENT_DISASTER_TTL_MS);
    for (const [id, ts] of BunkerGameService.recentSituations) {
      if (now - ts > BunkerGameService.RECENT_SITUATION_TTL_MS) {
        BunkerGameService.recentSituations.delete(id);
      }
    }
  }

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
    cards: Array<{ id: string; type: BunkerCardType; text: string; isAdult: boolean; tags: string[] }>,
    players: Array<{ userKey: string }>,
    options: { adultMode: boolean; disasterTags: string[] }
  ): Record<BunkerCardType, string[]> {
    // Each tag overlap between a card and the disaster's useful/vulnerable
    // tags bumps the card's pick weight. Higher = more thematic skew.
    // Keep it modest so unrelated cards still appear for drama (e.g. a
    // ballerina in a nuclear war).
    const TAG_WEIGHT_BOOST = 2;
    const disasterTagSet = new Set(options.disasterTags);
    const weightFor = (card: { tags: string[] }): number => {
      let overlap = 0;
      for (const t of card.tags) if (disasterTagSet.has(t)) overlap += 1;
      return 1 + overlap * TAG_WEIGHT_BOOST;
    };
    const weightedPick = <T extends { id: string; tags: string[] }>(pool: T[]): T => {
      if (pool.length === 1) return pool[0];
      const weights = pool.map(weightFor);
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * total;
      for (let i = 0; i < pool.length; i += 1) {
        roll -= weights[i];
        if (roll <= 0) return pool[i];
      }
      return pool[pool.length - 1];
    };
    const playerCount = players.length;
    const deal = {} as Record<BunkerCardType, string[]>;

    // Snapshot each player's personal cooldown once up front.
    const cooldownByIdx = players.map((p) =>
      BunkerGameService.cooldownActive(
        BunkerGameService.recentCardsByUser,
        p.userKey,
        BunkerGameService.RECENT_CARD_TTL_MS
      )
    );

    // Decide WHICH player slot is guaranteed an adult card in WHICH type.
    // Round-robin assigns each player a single guaranteed adult type so
    // every hand contains at least one adult card overall. Skips types
    // without any adult cards in the seed.
    const adultIdxByType = new Map<BunkerCardType, Set<number>>();
    if (options.adultMode) {
      const adultsPerType = new Map<BunkerCardType, number>();
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
        const usagePerType = new Map<BunkerCardType, number>();
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

        const picked = disasterTagSet.size > 0
          ? weightedPick(candidates)
          : candidates[randomInt(candidates.length)];
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
      BunkerGameService.cooldownAdd(
        BunkerGameService.recentCardsByUser,
        userKey,
        ids
      );
    }

    return deal;
  }

  private extractCards(
    bunkerAttributes:
      | Prisma.BunkerPlayerAttributeGetPayload<Record<string, never>>
      | null
      | undefined,
    cardTranslations: CardTranslationMap
  ): Record<string, LocalizedText> {
    if (!bunkerAttributes) {
      return {};
    }

    return {
      [BunkerCardType.PROFESSION]: this.localizeCardValue(
        BunkerCardType.PROFESSION,
        bunkerAttributes.profession,
        cardTranslations
      ),
      [BunkerCardType.HEALTH]: this.localizeCardValue(
        BunkerCardType.HEALTH,
        bunkerAttributes.health,
        cardTranslations
      ),
      [BunkerCardType.CHARACTER]: this.localizeCardValue(
        BunkerCardType.CHARACTER,
        bunkerAttributes.character,
        cardTranslations
      ),
      [BunkerCardType.SKILL]: this.localizeCardValue(
        BunkerCardType.SKILL,
        bunkerAttributes.skill,
        cardTranslations
      ),
      [BunkerCardType.BAGGAGE]: this.localizeCardValue(
        BunkerCardType.BAGGAGE,
        bunkerAttributes.baggage,
        cardTranslations
      ),
      [BunkerCardType.FACT]: this.localizeCardValue(
        BunkerCardType.FACT,
        bunkerAttributes.fact,
        cardTranslations
      )
    };
  }

  private extractRevealedCards(
    bunkerAttributes:
      | Prisma.BunkerPlayerAttributeGetPayload<Record<string, never>>
      | null
      | undefined,
    cardTranslations: CardTranslationMap
  ) {
    const cards = this.extractCards(bunkerAttributes, cardTranslations);
    const revealed = bunkerAttributes?.revealed ?? [];

    return Object.fromEntries(revealed.map((type) => [type, cards[type]]));
  }

  private extractCardTags(
    bunkerAttributes:
      | Prisma.BunkerPlayerAttributeGetPayload<Record<string, never>>
      | null
      | undefined,
    cardTags: CardTagsMap
  ): Record<string, string[]> {
    if (!bunkerAttributes) return {};
    const lookup = (type: BunkerCardType, text: string) =>
      cardTags.get(this.cardTranslationKey(type, text)) ?? [];
    return {
      [BunkerCardType.PROFESSION]: lookup(BunkerCardType.PROFESSION, bunkerAttributes.profession),
      [BunkerCardType.HEALTH]: lookup(BunkerCardType.HEALTH, bunkerAttributes.health),
      [BunkerCardType.CHARACTER]: lookup(BunkerCardType.CHARACTER, bunkerAttributes.character),
      [BunkerCardType.SKILL]: lookup(BunkerCardType.SKILL, bunkerAttributes.skill),
      [BunkerCardType.BAGGAGE]: lookup(BunkerCardType.BAGGAGE, bunkerAttributes.baggage),
      [BunkerCardType.FACT]: lookup(BunkerCardType.FACT, bunkerAttributes.fact)
    };
  }

  private extractRevealedCardTags(
    bunkerAttributes:
      | Prisma.BunkerPlayerAttributeGetPayload<Record<string, never>>
      | null
      | undefined,
    cardTags: CardTagsMap
  ): Record<string, string[]> {
    const all = this.extractCardTags(bunkerAttributes, cardTags);
    const revealed = bunkerAttributes?.revealed ?? [];
    return Object.fromEntries(revealed.map((type) => [type, all[type] ?? []]));
  }

  // Compares a player's REVEALED tags against the current situation's
  // highlight/weak tag pools. Green > Red means the player's exposed cards
  // are net-useful for this situation; Red > Green means they look like a
  // liability. UI uses this purely as a discussion hint — voting is free.
  private computeSituationBadge(
    revealedTagsByType: Record<string, string[]>,
    highlightTags: string[],
    weakTags: string[]
  ): "green" | "red" | "neutral" {
    if (highlightTags.length === 0 && weakTags.length === 0) return "neutral";
    const highlight = new Set(highlightTags);
    const weak = new Set(weakTags);
    let green = 0;
    let red = 0;
    for (const tags of Object.values(revealedTagsByType)) {
      for (const t of tags) {
        if (highlight.has(t)) green += 1;
        if (weak.has(t)) red += 1;
      }
    }
    if (red > green) return "red";
    if (green > red) return "green";
    return "neutral";
  }

  private cardTranslationKey(type: BunkerCardType, text: string) {
    return `${type}:${text}`;
  }

  private localizeCardValue(
    type: BunkerCardType,
    text: string,
    cardTranslations: CardTranslationMap
  ): LocalizedText {
    return (
      cardTranslations.get(this.cardTranslationKey(type, text)) ??
      buildLocalizedText(text)
    );
  }

  private getRemainingSeconds(timerEndsAt: Date | null) {
    if (!timerEndsAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((timerEndsAt.getTime() - Date.now()) / 1000));
  }

  // Start a 1Hz countdown for the room. `endsAt` mirrors the value just
  // written to `bunkerGame.timerEndsAt` — passing it in lets us tick from
  // memory and skip a per-second DB read for every active room. We only
  // touch Prisma when the deadline elapses, to read the fresh phase and
  // dispatch the right resolution method.
  private startTimer(roomCode: string, endsAt: Date) {
    this.stopTimer(roomCode);
    const code = roomCode.toUpperCase();
    const endsAtMs = endsAt.getTime();

    const interval = setInterval(async () => {
      try {
        const remainingSeconds = Math.max(
          0,
          Math.ceil((endsAtMs - Date.now()) / 1000)
        );
        this.realtime.broadcastTimer(roomCode, remainingSeconds);

        if (remainingSeconds > 0) return;

        this.stopTimer(roomCode);

        const room = await prisma.room.findUnique({
          where: { code },
          include: { bunkerGame: true }
        });
        if (!room?.bunkerGame) return;

        if (room.bunkerGame.phase === BunkerPhase.INTRO) {
          await this.beginNextRound(roomCode);
        } else if (room.bunkerGame.phase === BunkerPhase.ROUND_REVEAL) {
          await this.autoRevealCurrentTurn(roomCode);
        } else if (room.bunkerGame.phase === BunkerPhase.ROUND_PITCH) {
          await this.advanceTurnForRoom(roomCode);
        } else if (room.bunkerGame.phase === BunkerPhase.VOTING) {
          await this.resolveVoting(roomCode);
        } else if (room.bunkerGame.phase === BunkerPhase.ROUND_COMPLETE) {
          await this.beginNextRound(roomCode);
        }

        await this.realtime.broadcastRoomState(roomCode);
      } catch (error) {
        console.error(error);
        this.stopTimer(roomCode);
      }
    }, 1000);

    this.timers.set(roomCode, { interval, endsAt: endsAtMs });
  }

  private stopTimer(roomCode: string) {
    const entry = this.timers.get(roomCode);

    if (entry) {
      clearInterval(entry.interval);
      this.timers.delete(roomCode);
    }
  }
}
