import {
  GameOutcome,
  GameType,
  MafiaPhase,
  MafiaRole,
  Prisma,
  RoomStatus
} from "@prisma/client";
import { randomBytes, randomInt } from "node:crypto";

import { prisma } from "../../lib/prisma";

import {
  MAFIA_DOCTOR_MAX_SELF_HEALS,
  MAFIA_SHERIFF_MAX_SHOTS,
  type MafiaPublicState
} from "./mafia-types";

type RealtimePublisher = {
  broadcastRoomState: (roomCode: string) => Promise<void>;
  broadcastTimer: (roomCode: string, remainingSeconds: number) => void;
  isSessionOnline?: (roomCode: string, sessionId: string) => boolean;
};

type CreateRoomInput = {
  hostName: string;
  sessionId: string;
  hostUserId?: string;
  maxPlayers?: number;
  mafiaCount: number;
  hasSheriff: boolean;
  hasDoctor: boolean;
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

type RoomWithMafiaState = Prisma.RoomGetPayload<{
  include: {
    players: {
      include: {
        mafiaRole: true;
      };
      orderBy: { seatOrder: "asc" };
    };
    mafiaGame: true;
  };
}>;

const noopRealtime: RealtimePublisher = {
  broadcastRoomState: async () => undefined,
  broadcastTimer: () => undefined,
  isSessionOnline: () => true
};

export class MafiaGameService {
  private realtime: RealtimePublisher = noopRealtime;

  setRealtime(publisher: RealtimePublisher) {
    this.realtime = publisher;
  }

  async shutdown() {
    // Mafia hozircha persistent timer'ga ega emas — taymerlar tun
    // bosqichi qo'shilganda paydo bo'ladi va shu yerda to'xtatiladi.
  }

  // ────────────────────────────────────────────────────────────────
  // Room lifecycle (lobby)
  // ────────────────────────────────────────────────────────────────

  async createRoom(input: CreateRoomInput) {
    const maxPlayers = Math.max(4, Math.min(input.maxPlayers ?? 10, 16));
    const mafiaCount = Math.max(1, Math.min(input.mafiaCount, Math.floor(maxPlayers / 2)));
    const hasSheriff = !!input.hasSheriff;
    const hasDoctor = !!input.hasDoctor;

    // Validate composition: at least one citizen must remain after the
    // special roles are taken. With `mafiaCount + sheriff? + doctor? + 1
    // citizen ≤ maxPlayers` we guarantee a winnable city team.
    const specialRoleCount = mafiaCount + (hasSheriff ? 1 : 0) + (hasDoctor ? 1 : 0);
    if (specialRoleCount + 1 > maxPlayers) {
      throw new Error(
        "Tarkib noto'g'ri: kamida 1 ta oddiy aholi qoladigan qilib sozlang."
      );
    }

    const code = await this.generateRoomCode();

    const room = await prisma.room.create({
      data: {
        code,
        gameType: GameType.MAFIA,
        hostSessionId: input.sessionId,
        hostUserId: input.hostUserId ?? null,
        winnerTarget: 1, // Mafia uchun ishlatilmaydi, lekin schema majburiy
        maxPlayers,
        players: {
          create: {
            name: input.hostName.trim(),
            sessionId: input.sessionId,
            userId: input.hostUserId ?? null,
            isHost: true,
            seatOrder: 1
          }
        },
        mafiaGame: {
          create: {
            phase: MafiaPhase.ASSIGN_ROLES,
            mafiaCount,
            hasSheriff,
            hasDoctor
          }
        }
      },
      include: { players: true }
    });

    return {
      roomCode: room.code,
      playerId: room.players[0]?.id
    };
  }

  async joinRoom(input: JoinRoomInput) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: { players: { orderBy: { seatOrder: "asc" } } }
    });

    if (!room) throw new Error("Room topilmadi.");
    if (room.gameType !== GameType.MAFIA) {
      throw new Error("Bu Mafia o'yini emas.");
    }
    if (room.status !== RoomStatus.LOBBY) {
      throw new Error(
        "O'yin boshlanganidan keyin yangi o'yinchi qo'shila olmaydi."
      );
    }

    // Re-attach existing player if same user opens from another device.
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

    const existing = room.players.find((p) => p.sessionId === input.sessionId);
    if (existing) {
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

    await this.realtime.broadcastRoomState(room.code);
    return { roomCode: room.code, playerId: player.id };
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
      throw new Error(
        "Host xonadan chiqa olmaydi. O'yinni tugating yoki bekor qiling."
      );
    }
    await prisma.player.delete({ where: { id: me.id } });
  }

  async kickPlayer(input: RoomCodeAction & { targetPlayerId: string }) {
    const room = await this.requireHostRoom(input);
    if (room.status !== RoomStatus.LOBBY) {
      throw new Error("O'yin boshlanganidan keyin kick qilib bo'lmaydi.");
    }
    const target = room.players.find((p) => p.id === input.targetPlayerId);
    if (!target) throw new Error("O'yinchi topilmadi.");
    if (target.isHost) throw new Error("Hostni chiqarib bo'lmaydi.");
    await prisma.player.delete({ where: { id: target.id } });
  }

  async startGame(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);
    if (!room.mafiaGame) throw new Error("O'yin state topilmadi.");
    if (room.status !== RoomStatus.LOBBY) {
      throw new Error("O'yin allaqachon boshlangan.");
    }

    const config = room.mafiaGame;
    const required =
      config.mafiaCount +
      (config.hasSheriff ? 1 : 0) +
      (config.hasDoctor ? 1 : 0) +
      1;
    if (room.players.length < required) {
      throw new Error(
        `O'yinni boshlash uchun kamida ${required} ta o'yinchi kerak.`
      );
    }

    // Build the role bag according to the host config. Citizens fill
    // the remainder so player count > minimum still has a valid seat
    // assignment.
    const roles: MafiaRole[] = [];
    for (let i = 0; i < config.mafiaCount; i += 1) roles.push(MafiaRole.MAFIA);
    if (config.hasSheriff) roles.push(MafiaRole.SHERIFF);
    if (config.hasDoctor) roles.push(MafiaRole.DOCTOR);
    while (roles.length < room.players.length) roles.push(MafiaRole.CITIZEN);

    // Fisher-Yates shuffle backed by crypto.randomInt — same approach
    // Bunker uses for card deals, so role assignment is unbiased and
    // not predictable from prior seats.
    for (let i = roles.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    const gameId = config.id;
    const startedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.PLAYING }
      });
      await tx.mafiaGame.update({
        where: { id: gameId },
        data: {
          phase: MafiaPhase.ASSIGN_ROLES,
          startedAt,
          // First night/day haven't started yet — they tick when we
          // leave ASSIGN_ROLES.
          nightNumber: 0,
          dayNumber: 0
        }
      });
      // Wipe any prior role rows in case startGame is somehow called
      // twice (defensive — `requireHostRoom + status check` should
      // prevent this, but transactions are cheap).
      await tx.mafiaPlayerRole.deleteMany({ where: { gameId } });
      for (let i = 0; i < room.players.length; i += 1) {
        await tx.mafiaPlayerRole.create({
          data: {
            gameId,
            playerId: room.players[i].id,
            role: roles[i]
          }
        });
      }
    });
  }

  // Player taps "Tasdiqlash" on the role-reveal screen. Once every
  // alive player has confirmed, we automatically advance to the first
  // night. The host can also force-advance via `nextPhase` (added in
  // the night-stage commit).
  async confirmRole(input: RoomCodeAction) {
    const room = await this.getRoomWithState(input.code);
    if (!room || !room.mafiaGame) throw new Error("Room state topilmadi.");
    if (room.gameType !== GameType.MAFIA) {
      throw new Error("Bu Mafia o'yini emas.");
    }
    if (room.mafiaGame.phase !== MafiaPhase.ASSIGN_ROLES) {
      throw new Error("Hozir rol tasdiqlash bosqichi emas.");
    }
    const me = room.players.find((p) => p.sessionId === input.sessionId);
    if (!me || !me.mafiaRole) {
      throw new Error("Sizning rolingiz topilmadi.");
    }
    if (me.mafiaRole.roleConfirmed) return; // Idempotent — second tap is a no-op.

    await prisma.mafiaPlayerRole.update({
      where: { id: me.mafiaRole.id },
      data: { roleConfirmed: true }
    });

    // Re-check: if everyone has confirmed, advance the phase. We could
    // skip this DB round-trip by counting from the in-memory list +
    // delta, but a fresh count is simpler and keeps the transition
    // logic in one place.
    const remaining = await prisma.mafiaPlayerRole.count({
      where: {
        gameId: room.mafiaGame.id,
        isAlive: true,
        roleConfirmed: false
      }
    });
    if (remaining === 0) {
      await this.advanceToNight(room.mafiaGame.id);
    }
  }

  // First night begins. Subsequent nights also flow through here once
  // day-vote / day-result are wired up.
  private async advanceToNight(gameId: string) {
    const game = await prisma.mafiaGame.findUnique({ where: { id: gameId } });
    if (!game) return;
    await prisma.mafiaGame.update({
      where: { id: gameId },
      data: {
        phase: MafiaPhase.NIGHT,
        nightNumber: game.nightNumber + 1,
        // Night timer is a strict 20s window — clients render dummy
        // taps for citizens during this time.
        timerEndsAt: new Date(Date.now() + 20_000)
      }
    });
  }

  async endGame(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);
    if (!room.mafiaGame) throw new Error("O'yin state topilmadi.");
    if (room.status === RoomStatus.FINISHED || room.status === RoomStatus.CANCELLED) {
      return;
    }

    const wasLobby = room.status === RoomStatus.LOBBY;
    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { status: wasLobby ? RoomStatus.CANCELLED : RoomStatus.FINISHED }
      }),
      prisma.mafiaGame.update({
        where: { id: room.mafiaGame.id },
        data: { phase: MafiaPhase.FINISHED, timerEndsAt: null }
      })
    ]);

    if (!wasLobby && room.hostUserId) {
      // Mirror Bunker: cancelled-mid-game still records a history row so
      // the host's monthly limit reflects the attempt.
      await prisma.gameHistory.create({
        data: {
          userId: room.hostUserId,
          gameType: GameType.MAFIA,
          playedAt: new Date(),
          startedAt: room.mafiaGame.startedAt,
          endedAt: null,
          outcome: GameOutcome.CANCELLED,
          roomCode: room.code,
          playerCount: room.players.length,
          metadata: Prisma.JsonNull
        }
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Public state
  // ────────────────────────────────────────────────────────────────

  async getRoomState(code: string, sessionId: string): Promise<MafiaPublicState> {
    const room = await this.getRoomWithState(code);
    if (!room || !room.mafiaGame) {
      throw new Error("Room state topilmadi.");
    }
    return this.buildPublicState(room, sessionId);
  }

  async getRoomStateForBroadcast(code: string): Promise<{
    room: RoomWithMafiaState;
    perSession: (sessionId: string) => MafiaPublicState;
  }> {
    const room = await this.getRoomWithState(code);
    if (!room || !room.mafiaGame) {
      throw new Error("Room state topilmadi.");
    }
    return {
      room,
      perSession: (sessionId: string) => this.buildPublicState(room, sessionId)
    };
  }

  private buildPublicState(
    room: RoomWithMafiaState,
    sessionId: string
  ): MafiaPublicState {
    if (!room.mafiaGame) throw new Error("Room state topilmadi.");
    const game = room.mafiaGame;
    const me = room.players.find((p) => p.sessionId === sessionId) ?? null;
    const myRole = me?.mafiaRole ?? null;

    // Mafia teammates: only revealed to mafia members. Citizens, sheriff,
    // and doctor see nothing here.
    const mafiaTeammates =
      myRole?.role === "MAFIA"
        ? room.players
            .filter((p) => p.mafiaRole?.role === "MAFIA" && p.id !== me?.id)
            .map((p) => p.id)
        : [];

    // ASSIGN_ROLES bosqichida host va o'yinchilarga "X / N tasdiqladi"
    // ko'rsatish uchun. Tirik o'yinchilardan rolini tasdiqlaganlar soni
    // hisoblab beriladi — `kicked` yoki rol tushmagan o'yinchilar
    // hisobga olinmaydi.
    const aliveWithRole = room.players.filter(
      (p) => p.mafiaRole && p.mafiaRole.isAlive
    );
    const confirmedCount = aliveWithRole.filter(
      (p) => p.mafiaRole?.roleConfirmed
    ).length;

    const sheriffShotsRemaining = Math.max(
      0,
      MAFIA_SHERIFF_MAX_SHOTS - game.sheriffShotsUsed
    );
    const doctorSelfHealsRemaining = Math.max(
      0,
      MAFIA_DOCTOR_MAX_SELF_HEALS - game.doctorSelfHealsUsed
    );

    return {
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        maxPlayers: room.maxPlayers
      },
      game: {
        phase: game.phase,
        nightNumber: game.nightNumber,
        dayNumber: game.dayNumber,
        timerEndsAt: game.timerEndsAt ? game.timerEndsAt.toISOString() : null,
        remainingSeconds: this.getRemainingSeconds(game.timerEndsAt),
        config: {
          mafiaCount: game.mafiaCount,
          hasSheriff: game.hasSheriff,
          hasDoctor: game.hasDoctor
        },
        sheriffShotsRemaining,
        doctorSelfHealsRemaining,
        roleConfirmations: {
          confirmed: confirmedCount,
          total: aliveWithRole.length
        },
        winner: game.winner,
        lastNightVictims: [],
        lastNightDoctorSaved: false,
        lastEliminatedPlayerId: null,
        lastEliminatedRole: null,
        tiebreakCandidateIds: []
      },
      me: me
        ? {
            id: me.id,
            name: me.name,
            isHost: me.isHost,
            isAlive: me.isAlive,
            sessionId: me.sessionId,
            role: myRole?.role ?? null,
            mafiaTeammates,
            sheriffChecks: [],
            citizenQuestion: null,
            pendingNightTargetId: null,
            roleConfirmed: myRole?.roleConfirmed ?? false
          }
        : null,
      players: room.players.map((p) => {
        const isOnline =
          this.realtime.isSessionOnline?.(room.code, p.sessionId) ?? true;
        // A teammate-mafia view sees other mafia roles even if not yet
        // publicly revealed. Otherwise role is exposed only on death.
        const showRole =
          p.mafiaRole?.roleRevealed === true ||
          (myRole?.role === "MAFIA" && p.mafiaRole?.role === "MAFIA");
        return {
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          isAlive: p.isAlive,
          online: isOnline,
          seatOrder: p.seatOrder,
          revealedRole: showRole ? p.mafiaRole?.role ?? null : null
        };
      }),
      mafiaPicks: [],
      votes: { total: 0, submittedByMe: false }
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  private async requireHostRoom(input: RoomCodeAction): Promise<RoomWithMafiaState> {
    const room = await this.getRoomWithState(input.code);
    if (!room) throw new Error("Room topilmadi.");
    if (room.gameType !== GameType.MAFIA) {
      throw new Error("Bu Mafia o'yini emas.");
    }
    if (room.hostSessionId !== input.sessionId) {
      throw new Error("Faqat host bu amalni bajara oladi.");
    }
    return room;
  }

  private async getRoomWithState(code: string): Promise<RoomWithMafiaState | null> {
    return prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: {
          include: { mafiaRole: true },
          orderBy: { seatOrder: "asc" }
        },
        mafiaGame: true
      }
    });
  }

  private async generateRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
      const exists = await prisma.room.findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw new Error("Room code yaratib bo'lmadi.");
  }

  private getRemainingSeconds(timerEndsAt: Date | null) {
    if (!timerEndsAt) return 0;
    return Math.max(
      0,
      Math.ceil((timerEndsAt.getTime() - Date.now()) / 1000)
    );
  }
}
