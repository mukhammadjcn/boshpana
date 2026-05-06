import {
  GameOutcome,
  GameType,
  MafiaCitizenQuestion,
  MafiaEliminationCause,
  MafiaNightActionType,
  MafiaPhase,
  MafiaRole,
  MafiaTeam,
  Prisma,
  RoomStatus
} from "@prisma/client";
import { randomBytes, randomInt } from "node:crypto";

import { prisma } from "../../lib/prisma";
import { hostTransferService } from "../../services/host-transfer-service";
import { shouldAutoStartOnlineLobby } from "../../services/online-lobby-service";
import {
  getMafiaResultRevealDurationSeconds,
  isSelfManagedOnlineRoom
} from "../online/online-self-managed-rules";

import {
  MAFIA_DAY_DISCUSSION_DURATION_SECONDS,
  MAFIA_DAY_TIEBREAK_DURATION_SECONDS,
  MAFIA_DAY_VOTE_DURATION_SECONDS,
  MAFIA_DOCTOR_MAX_SELF_HEALS,
  MAFIA_NIGHT_DURATION_SECONDS,
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
    mafiaGame: {
      include: {
        nightSubmissions: true;
        dayVotes: true;
      };
    };
  };
}>;

const noopRealtime: RealtimePublisher = {
  broadcastRoomState: async () => undefined,
  broadcastTimer: () => undefined,
  isSessionOnline: () => true
};

export class MafiaGameService {
  private realtime: RealtimePublisher = noopRealtime;

  // Per-room interval timers — same pattern as Bunker. Each tick checks
  // the persisted `timerEndsAt` against now, broadcasts the remaining
  // seconds, and resolves the phase when the deadline passes. We key on
  // roomCode (uppercase) so reconnects don't double-start.
  private readonly timers = new Map<string, NodeJS.Timeout>();

  setRealtime(publisher: RealtimePublisher) {
    this.realtime = publisher;
  }

  async shutdown() {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  // ────────────────────────────────────────────────────────────────
  // Room lifecycle (lobby)
  // ────────────────────────────────────────────────────────────────

  async createRoom(input: CreateRoomInput) {
    const maxPlayers = Math.max(4, Math.min(input.maxPlayers ?? 15, 15));
    const maxMafiaCount = Math.max(
      1,
      Math.min(
        3,
        maxPlayers - (input.hasSheriff ? 1 : 0) - (input.hasDoctor ? 1 : 0) - 1
      )
    );
    const mafiaCount = Math.max(1, Math.min(input.mafiaCount, maxMafiaCount));
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
      if (room.mode === "ONLINE") {
        const transfer = await hostTransferService.transferOnlineRoomHost({
          roomCode: room.code,
          expectedHostSessionId: input.sessionId,
          currentHostPlayerId: me.id
        });

        if (transfer?.kind === "transferred") {
          await prisma.player.delete({ where: { id: me.id } });
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
        return;
      }
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

  async toggleReady(input: RoomCodeAction) {
    const room = await prisma.room.findUnique({
      where: { code: input.code.toUpperCase() },
      include: {
        players: { orderBy: { seatOrder: "asc" } },
        mafiaGame: true
      }
    });
    if (!room) throw new Error("Room topilmadi.");
    if (room.gameType !== GameType.MAFIA) {
      throw new Error("Bu Mafia o'yini emas.");
    }
    if (room.mode !== "ONLINE") {
      throw new Error("Tayyorman faqat online lobby uchun ishlaydi.");
    }
    if (room.status !== RoomStatus.LOBBY) {
      throw new Error("O'yin boshlanganidan keyin tayyor holatini o'zgartirib bo'lmaydi.");
    }
    if (!room.mafiaGame) {
      throw new Error("O'yin state topilmadi.");
    }

    const me = room.players.find((player) => player.sessionId === input.sessionId);
    if (!me) throw new Error("O'yinchi topilmadi.");

    const required =
      room.mafiaGame.mafiaCount +
      (room.mafiaGame.hasSheriff ? 1 : 0) +
      (room.mafiaGame.hasDoctor ? 1 : 0) +
      1;
    if (room.players.length < required && !me.readyAt) {
      throw new Error(
        `Kamida ${required} ta o'yinchi bo'lgach tayyor holatini yoqish mumkin.`
      );
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
        players: { orderBy: { seatOrder: "asc" } },
        mafiaGame: true
      }
    });

    if (
      refreshed?.mafiaGame &&
      shouldAutoStartOnlineLobby(refreshed.players, required)
    ) {
      await this.startGame({
        code: refreshed.code,
        sessionId: refreshed.hostSessionId
      });
    }
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
      await tx.player.updateMany({
        where: { roomId: room.id },
        data: { readyAt: null }
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
  // alive player has confirmed, the host can start the first night
  // via `mafia:advance_phase`.
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

    if (!isSelfManagedOnlineRoom(room.mode)) {
      return;
    }

    const confirmedCount = await prisma.mafiaPlayerRole.count({
      where: {
        gameId: room.mafiaGame.id,
        isAlive: true,
        roleConfirmed: true
      }
    });
    const aliveCount = room.players.filter((player) => player.mafiaRole?.isAlive).length;

    if (confirmedCount >= aliveCount) {
      await this.advanceToNight(room.mafiaGame.id);
    }
  }

  // First night begins. Subsequent nights also flow through here once
  // day-vote / day-result are wired up.
  private async advanceToNight(gameId: string) {
    const game = await prisma.mafiaGame.findUnique({
      where: { id: gameId },
      include: {
        room: { select: { code: true } },
        playerRoles: { where: { isAlive: true } }
      }
    });
    if (!game) return;

    const newNightNumber = game.nightNumber + 1;
    const timerEndsAt = new Date(
      Date.now() + MAFIA_NIGHT_DURATION_SECONDS * 1000
    );

    // Pre-pick a random citizen question for each alive citizen so the
    // moment the NIGHT state broadcasts, citizens already see their
    // prompt. Pre-creating their submission row also ensures the upsert
    // path on /submit_night_action can update an existing row instead
    // of racing to insert one.
    const citizens = game.playerRoles.filter(
      (pr) => pr.role === MafiaRole.CITIZEN
    );
    const citizenSeeds = citizens.map((c) => {
      const useKill = randomInt(2) === 0;
      const question = useKill
        ? MafiaCitizenQuestion.GUESS_MAFIA_KILL
        : MafiaCitizenQuestion.GUESS_DOCTOR_HEAL;
      const action = useKill
        ? MafiaNightActionType.CITIZEN_GUESS_KILL
        : MafiaNightActionType.CITIZEN_GUESS_HEAL;
      return { playerId: c.playerId, question, action };
    });

    await prisma.$transaction(async (tx) => {
      await tx.mafiaGame.update({
        where: { id: gameId },
        data: {
          phase: MafiaPhase.NIGHT,
          nightNumber: newNightNumber,
          timerEndsAt,
          // Reset previous-night flags so NIGHT_RESULT renders cleanly
          // when this new night resolves.
          lastNightDoctorSaved: false
        }
      });
      for (const seed of citizenSeeds) {
        await tx.mafiaNightSubmission.upsert({
          where: {
            gameId_nightNumber_actorPlayerId: {
              gameId,
              nightNumber: newNightNumber,
              actorPlayerId: seed.playerId
            }
          },
          create: {
            gameId,
            nightNumber: newNightNumber,
            actorPlayerId: seed.playerId,
            action: seed.action,
            targetPlayerId: null,
            citizenQuestion: seed.question
          },
          update: {}
        });
      }
    });

    this.startTimer(game.room.code);
  }

  // ────────────────────────────────────────────────────────────────
  // Night actions
  // ────────────────────────────────────────────────────────────────

  // Per-role allowed actions. Keeps the validation matrix readable and
  // ensures a citizen can't smuggle a MAFIA_KILL into their submission.
  private static readonly ROLE_ACTIONS: Record<
    MafiaRole,
    readonly MafiaNightActionType[]
  > = {
    [MafiaRole.MAFIA]: [MafiaNightActionType.MAFIA_KILL],
    [MafiaRole.SHERIFF]: [
      MafiaNightActionType.SHERIFF_CHECK,
      MafiaNightActionType.SHERIFF_SHOOT
    ],
    [MafiaRole.DOCTOR]: [MafiaNightActionType.DOCTOR_HEAL],
    [MafiaRole.CITIZEN]: [
      MafiaNightActionType.CITIZEN_GUESS_KILL,
      MafiaNightActionType.CITIZEN_GUESS_HEAL
    ]
  };

  async submitNightAction(
    input: RoomCodeAction & {
      action: MafiaNightActionType;
      targetPlayerId: string | null;
    }
  ) {
    const room = await this.getRoomWithState(input.code);
    if (!room || !room.mafiaGame) throw new Error("Room state topilmadi.");
    if (room.gameType !== GameType.MAFIA) {
      throw new Error("Bu Mafia o'yini emas.");
    }
    const game = room.mafiaGame;
    if (game.phase !== MafiaPhase.NIGHT) {
      throw new Error("Hozir tun bosqichi emas.");
    }

    const me = room.players.find((p) => p.sessionId === input.sessionId);
    if (!me || !me.mafiaRole) throw new Error("O'yinchi topilmadi.");
    if (!me.mafiaRole.isAlive) {
      throw new Error("O'lgan o'yinchi harakat qila olmaydi.");
    }
    const myRole = me.mafiaRole.role;

    const allowed = MafiaGameService.ROLE_ACTIONS[myRole];
    if (!allowed.includes(input.action)) {
      throw new Error("Bu harakat sizning rolingizga mos kelmaydi.");
    }

    if (myRole === MafiaRole.SHERIFF) {
      const existing = await prisma.mafiaNightSubmission.findUnique({
        where: {
          gameId_nightNumber_actorPlayerId: {
            gameId: game.id,
            nightNumber: game.nightNumber,
            actorPlayerId: me.id
          }
        }
      });
      if (existing?.isConfirmed) {
        throw new Error("Komisar bu tunda faqat bitta odamni tanlay oladi.");
      }
    }

    const existing = await prisma.mafiaNightSubmission.findUnique({
      where: {
        gameId_nightNumber_actorPlayerId: {
          gameId: game.id,
          nightNumber: game.nightNumber,
          actorPlayerId: me.id
        }
      }
    });
    if (existing?.isConfirmed) {
      throw new Error("Tasdiqlangan tungi qarorni o'zgartirib bo'lmaydi.");
    }

    // Sheriff shoot caps — the schema column tracks usage across all
    // nights. We don't fail just because the sheriff *re-clicked* shoot
    // during the same night (upsert replaces); we only enforce the cap
    // at submit time so the state stays consistent.
    if (input.action === MafiaNightActionType.SHERIFF_SHOOT) {
      const remaining = MAFIA_SHERIFF_MAX_SHOTS - game.sheriffShotsUsed;
      if (remaining <= 0) throw new Error("O'qlar tugagan.");
    }

    // Doctor self-heal cap — only enforced when the heal target is the
    // doctor themselves. Healing others is unlimited per spec.
    if (
      input.action === MafiaNightActionType.DOCTOR_HEAL &&
      input.targetPlayerId === me.id
    ) {
      const remaining =
        MAFIA_DOCTOR_MAX_SELF_HEALS - game.doctorSelfHealsUsed;
      if (remaining <= 0) {
        throw new Error("O'zingizni boshqa davolab bo'lmaydi.");
      }
    }

    // Validate target — must be alive and in the same game. Null target
    // is allowed (mafia/sheriff/doctor tap "skip" or are still picking).
    if (input.targetPlayerId !== null) {
      const target = room.players.find((p) => p.id === input.targetPlayerId);
      if (!target || !target.mafiaRole) throw new Error("Nishon topilmadi.");
      if (!target.mafiaRole.isAlive) throw new Error("Nishon hayot emas.");
    }

    // Citizens — preserve the question that was preassigned in
    // advanceToNight. The action they submit must match their seeded
    // question; if the client somehow flips the action, we coerce it
    // back to the seeded one so the dummy prompt stays stable.
    let citizenQuestion: MafiaCitizenQuestion | null = null;
    if (myRole === MafiaRole.CITIZEN) {
      const seeded = await prisma.mafiaNightSubmission.findUnique({
        where: {
          gameId_nightNumber_actorPlayerId: {
            gameId: game.id,
            nightNumber: game.nightNumber,
            actorPlayerId: me.id
          }
        }
      });
      citizenQuestion = seeded?.citizenQuestion ?? null;
    }

    await prisma.mafiaNightSubmission.upsert({
      where: {
        gameId_nightNumber_actorPlayerId: {
          gameId: game.id,
          nightNumber: game.nightNumber,
          actorPlayerId: me.id
        }
      },
      create: {
        gameId: game.id,
        nightNumber: game.nightNumber,
        actorPlayerId: me.id,
        action: input.action,
        targetPlayerId: input.targetPlayerId,
        citizenQuestion,
        isConfirmed: false
      },
      update: {
        action: input.action,
        targetPlayerId: input.targetPlayerId,
        isConfirmed: false,
        submittedAt: new Date()
      }
    });
  }

  async confirmNightAction(input: RoomCodeAction) {
    const room = await this.getRoomWithState(input.code);
    if (!room || !room.mafiaGame) throw new Error("Room state topilmadi.");
    if (room.gameType !== GameType.MAFIA) {
      throw new Error("Bu Mafia o'yini emas.");
    }
    const game = room.mafiaGame;
    if (game.phase !== MafiaPhase.NIGHT) {
      throw new Error("Hozir tun bosqichi emas.");
    }

    const me = room.players.find((p) => p.sessionId === input.sessionId);
    if (!me || !me.mafiaRole) throw new Error("O'yinchi topilmadi.");
    if (!me.mafiaRole.isAlive) {
      throw new Error("O'lgan o'yinchi harakat qila olmaydi.");
    }

    const submission = await prisma.mafiaNightSubmission.findUnique({
      where: {
        gameId_nightNumber_actorPlayerId: {
          gameId: game.id,
          nightNumber: game.nightNumber,
          actorPlayerId: me.id
        }
      }
    });
    if (!submission?.targetPlayerId) {
      throw new Error("Avval nishonni tanlang.");
    }
    if (submission.isConfirmed) return;

    await prisma.mafiaNightSubmission.update({
      where: { id: submission.id },
      data: { isConfirmed: true }
    });

    const aliveCount = room.players.filter((p) => p.mafiaRole?.isAlive).length;
    const confirmedCount = await prisma.mafiaNightSubmission.count({
      where: {
        gameId: game.id,
        nightNumber: game.nightNumber,
        isConfirmed: true
      }
    });
    if (confirmedCount >= aliveCount) {
      this.stopTimer(input.code);
      await this.resolveNight(input.code);
    }
  }

  // Server-side resolution at the end of the 20s window. Tally mafia
  // votes (mode, ties → most-recent submission), apply sheriff shoot
  // and doctor heal, mark deaths, transition to NIGHT_RESULT. The
  // public state's `lastNightVictims` array is derived from
  // MafiaPlayerRole rows where `eliminatedRound === nightNumber` so we
  // don't need to denormalise it on the game model.
  private async resolveNight(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);
    if (!room || !room.mafiaGame) return;
    const game = room.mafiaGame;
    if (game.phase !== MafiaPhase.NIGHT) return; // Race: another path advanced.

    const submissions = await prisma.mafiaNightSubmission.findMany({
      where: { gameId: game.id, nightNumber: game.nightNumber }
    });

    // ── Mafia kill: count targets, ties broken by latest submission.
    const mafiaTallies = new Map<
      string,
      { count: number; latest: Date }
    >();
    for (const s of submissions) {
      if (s.action !== MafiaNightActionType.MAFIA_KILL) continue;
      if (!s.targetPlayerId) continue;
      const cur = mafiaTallies.get(s.targetPlayerId) ?? {
        count: 0,
        latest: new Date(0)
      };
      cur.count += 1;
      if (s.submittedAt > cur.latest) cur.latest = s.submittedAt;
      mafiaTallies.set(s.targetPlayerId, cur);
    }
    let mafiaKillTarget: string | null = null;
    let bestCount = 0;
    let bestLatest = new Date(0);
    for (const [target, { count, latest }] of mafiaTallies) {
      if (
        count > bestCount ||
        (count === bestCount && latest > bestLatest)
      ) {
        mafiaKillTarget = target;
        bestCount = count;
        bestLatest = latest;
      }
    }

    // ── Sheriff shoot (single submission).
    const sheriffShootSub = submissions.find(
      (s) => s.action === MafiaNightActionType.SHERIFF_SHOOT && s.targetPlayerId
    );
    const sheriffShootTarget = sheriffShootSub?.targetPlayerId ?? null;

    // ── Doctor heal (single submission).
    const doctorHealSub = submissions.find(
      (s) => s.action === MafiaNightActionType.DOCTOR_HEAL && s.targetPlayerId
    );
    const doctorHealTarget = doctorHealSub?.targetPlayerId ?? null;
    const doctorHealedSelf =
      doctorHealSub != null &&
      doctorHealSub.actorPlayerId === doctorHealSub.targetPlayerId;

    // Doctor saves any attack whose target matches their heal. A single
    // heal can save against both mafia kill AND sheriff shoot if both
    // happened to converge on the same person.
    const mafiaSaved =
      mafiaKillTarget !== null && doctorHealTarget === mafiaKillTarget;
    const sheriffSaved =
      sheriffShootTarget !== null && doctorHealTarget === sheriffShootTarget;
    const doctorSavedAny = mafiaSaved || sheriffSaved;

    // Final death set — dedupe in case mafia + sheriff both targeted
    // the same player (rare, but possible if Sheriff suspects them).
    const deathRows: Array<{
      playerId: string;
      cause: MafiaEliminationCause;
    }> = [];
    if (mafiaKillTarget !== null && !mafiaSaved) {
      deathRows.push({
        playerId: mafiaKillTarget,
        cause: MafiaEliminationCause.MAFIA_KILL
      });
    }
    if (
      sheriffShootTarget !== null &&
      !sheriffSaved &&
      sheriffShootTarget !== mafiaKillTarget
    ) {
      deathRows.push({
        playerId: sheriffShootTarget,
        cause: MafiaEliminationCause.SHERIFF_SHOOT
      });
    }

    const sheriffShotIncrement = sheriffShootTarget !== null ? 1 : 0;
    const doctorSelfHealIncrement = doctorHealedSelf ? 1 : 0;
    const nightResultDelaySeconds = getMafiaResultRevealDurationSeconds(
      room.mode,
      "NIGHT_RESULT"
    );

    await prisma.$transaction(async (tx) => {
      for (const d of deathRows) {
        await tx.mafiaPlayerRole.update({
          where: { playerId: d.playerId },
          data: {
            isAlive: false,
            eliminatedRound: game.nightNumber,
            eliminatedCause: d.cause,
            roleRevealed: true
          }
        });
        await tx.player.update({
          where: { id: d.playerId },
          data: { isAlive: false }
        });
      }
      await tx.mafiaGame.update({
        where: { id: game.id },
        data: {
          phase: MafiaPhase.NIGHT_RESULT,
          timerEndsAt: nightResultDelaySeconds
            ? new Date(Date.now() + nightResultDelaySeconds * 1000)
            : null,
          sheriffShotsUsed: { increment: sheriffShotIncrement },
          doctorSelfHealsUsed: { increment: doctorSelfHealIncrement },
          lastNightDoctorSaved: doctorSavedAny
        }
      });
    });
    if (nightResultDelaySeconds) {
      this.startTimer(roomCode);
    }
    await this.realtime.broadcastRoomState(roomCode);
  }

  // ────────────────────────────────────────────────────────────────
  // Day cycle: NIGHT_RESULT → DAY_DISCUSSION → DAY_VOTE → [TIEBREAK]
  //            → DAY_RESULT → (NIGHT or FINISHED)
  // ────────────────────────────────────────────────────────────────

  // Reveal animation ended — check the win condition. If a team has
  // already won, jump straight to FINISHED so the table sees the win
  // banner instead of an empty discussion screen.
  private async advanceFromNightResult(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);
    if (!room || !room.mafiaGame) return;
    if (room.mafiaGame.phase !== MafiaPhase.NIGHT_RESULT) return;

    const winner = this.computeWinner(room.players);
    if (winner) {
      await this.finishGame(room, winner);
      return;
    }
    await this.advanceToDayDiscussion(room.mafiaGame.id, roomCode);
  }

  private async advanceToDayDiscussion(gameId: string, roomCode: string) {
    const game = await prisma.mafiaGame.findUnique({ where: { id: gameId } });
    if (!game) return;
    await prisma.mafiaGame.update({
      where: { id: gameId },
      data: {
        phase: MafiaPhase.DAY_DISCUSSION,
        dayNumber: game.dayNumber + 1,
        // 4 minute discussion window. Host can advance early via
        // mafia:advance_phase.
        timerEndsAt: new Date(
          Date.now() + MAFIA_DAY_DISCUSSION_DURATION_SECONDS * 1000
        ),
        // New day → reset the previous day's tiebreak / saved flags.
        tiebreakCandidateIds: [],
        lastNightDoctorSaved: false
      }
    });
    this.startTimer(roomCode);
    await this.realtime.broadcastRoomState(roomCode);
  }

  private async advanceToDayVote(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);
    if (!room || !room.mafiaGame) return;
    if (room.mafiaGame.phase !== MafiaPhase.DAY_DISCUSSION) return;
    await prisma.mafiaGame.update({
      where: { id: room.mafiaGame.id },
      data: {
        phase: MafiaPhase.DAY_VOTE,
        timerEndsAt: new Date(
          Date.now() + MAFIA_DAY_VOTE_DURATION_SECONDS * 1000
        ),
        tiebreakCandidateIds: []
      }
    });
    this.startTimer(roomCode);
    await this.realtime.broadcastRoomState(roomCode);
  }

  async submitDayVote(
    input: RoomCodeAction & { targetPlayerId: string }
  ) {
    const room = await this.getRoomWithState(input.code);
    if (!room || !room.mafiaGame) throw new Error("Room state topilmadi.");
    if (room.gameType !== GameType.MAFIA) {
      throw new Error("Bu Mafia o'yini emas.");
    }
    const game = room.mafiaGame;
    if (
      game.phase !== MafiaPhase.DAY_VOTE &&
      game.phase !== MafiaPhase.DAY_TIEBREAK
    ) {
      throw new Error("Hozir ovoz berish bosqichi emas.");
    }
    const me = room.players.find((p) => p.sessionId === input.sessionId);
    if (!me || !me.mafiaRole) throw new Error("O'yinchi topilmadi.");
    if (!me.mafiaRole.isAlive) throw new Error("O'lganlar ovoz bermaydi.");

    const target = room.players.find((p) => p.id === input.targetPlayerId);
    if (!target || !target.mafiaRole) throw new Error("Nishon topilmadi.");
    if (!target.mafiaRole.isAlive) throw new Error("O'lganga ovoz berib bo'lmaydi.");
    if (target.id === me.id) throw new Error("O'zingizga ovoz bera olmaysiz.");

    // Tiebreak — target must be one of the tied candidates from the
    // first pass. The set is stored on the game model.
    const isTiebreak = game.phase === MafiaPhase.DAY_TIEBREAK;
    const eligibleVoters = this.getDayVoteEligibleVoters(room.players, game);
    if (!eligibleVoters.some((p) => p.id === me.id)) {
      throw new Error("Bu bosqichda ovoz bera olmaysiz.");
    }
    if (isTiebreak && !game.tiebreakCandidateIds.includes(target.id)) {
      throw new Error("Bu o'yinchi tiebreak nomzodi emas.");
    }

    const existing = await prisma.mafiaDayVote.findUnique({
      where: {
        gameId_dayNumber_voterPlayerId_isTiebreak: {
          gameId: game.id,
          dayNumber: game.dayNumber,
          voterPlayerId: me.id,
          isTiebreak
        }
      }
    });
    if (existing?.isConfirmed) {
      throw new Error("Tasdiqlangan ovozni o'zgartirib bo'lmaydi.");
    }

    await prisma.mafiaDayVote.upsert({
      where: {
        gameId_dayNumber_voterPlayerId_isTiebreak: {
          gameId: game.id,
          dayNumber: game.dayNumber,
          voterPlayerId: me.id,
          isTiebreak
        }
      },
      create: {
        gameId: game.id,
        dayNumber: game.dayNumber,
        voterPlayerId: me.id,
        targetPlayerId: target.id,
        isTiebreak
      },
      update: {
        targetPlayerId: target.id,
        createdAt: new Date(),
        isConfirmed: false
      }
    });
  }

  async confirmDayVote(input: RoomCodeAction) {
    const room = await this.getRoomWithState(input.code);
    if (!room || !room.mafiaGame) throw new Error("Room state topilmadi.");
    if (room.gameType !== GameType.MAFIA) {
      throw new Error("Bu Mafia o'yini emas.");
    }
    const game = room.mafiaGame;
    if (
      game.phase !== MafiaPhase.DAY_VOTE &&
      game.phase !== MafiaPhase.DAY_TIEBREAK
    ) {
      throw new Error("Hozir ovoz berish bosqichi emas.");
    }
    const me = room.players.find((p) => p.sessionId === input.sessionId);
    if (!me || !me.mafiaRole) throw new Error("O'yinchi topilmadi.");
    if (!me.mafiaRole.isAlive) throw new Error("O'lganlar ovoz bermaydi.");

    const isTiebreak = game.phase === MafiaPhase.DAY_TIEBREAK;
    const eligibleVoters = this.getDayVoteEligibleVoters(room.players, game);
    if (!eligibleVoters.some((p) => p.id === me.id)) {
      throw new Error("Bu bosqichda ovoz bera olmaysiz.");
    }
    const vote = await prisma.mafiaDayVote.findUnique({
      where: {
        gameId_dayNumber_voterPlayerId_isTiebreak: {
          gameId: game.id,
          dayNumber: game.dayNumber,
          voterPlayerId: me.id,
          isTiebreak
        }
      }
    });
    if (!vote) {
      throw new Error("Avval kimga ovoz berishni tanlang.");
    }
    if (vote.isConfirmed) return;

    await prisma.mafiaDayVote.update({
      where: { id: vote.id },
      data: { isConfirmed: true }
    });

    const confirmedCount = await prisma.mafiaDayVote.count({
      where: {
        gameId: game.id,
        dayNumber: game.dayNumber,
        isTiebreak,
        isConfirmed: true
      }
    });
    if (confirmedCount >= eligibleVoters.length) {
      await this.resolveDayVote(input.code);
    }
  }

  // Tally votes for the current day. Single highest → elimination.
  // Tie on the first pass → DAY_TIEBREAK with just the tied candidates.
  // Tie on the tiebreak → no elimination this day.
  private async resolveDayVote(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);
    if (!room || !room.mafiaGame) return;
    const game = room.mafiaGame;
    if (
      game.phase !== MafiaPhase.DAY_VOTE &&
      game.phase !== MafiaPhase.DAY_TIEBREAK
    ) {
      return;
    }
    const isTiebreak = game.phase === MafiaPhase.DAY_TIEBREAK;

    const votes = await prisma.mafiaDayVote.findMany({
      where: {
        gameId: game.id,
        dayNumber: game.dayNumber,
        isTiebreak
      }
    });
    const tally = new Map<string, number>();
    for (const v of votes) {
      tally.set(v.targetPlayerId, (tally.get(v.targetPlayerId) ?? 0) + 1);
    }

    let topCount = 0;
    let topTargets: string[] = [];
    for (const [target, count] of tally) {
      if (count > topCount) {
        topCount = count;
        topTargets = [target];
      } else if (count === topCount) {
        topTargets.push(target);
      }
    }

    // No votes at all (everyone abstained — possible if the timer
    // expires before anyone submits). Treat as no elimination so the
    // game keeps moving.
    if (topCount === 0) {
      await this.transitionToDayResult(room, null);
      return;
    }

    if (topTargets.length === 1) {
      await this.transitionToDayResult(room, topTargets[0]);
      return;
    }

    // Tie. If we're already in tiebreak, no elimination this round —
    // can't loop forever.
    if (isTiebreak) {
      await this.transitionToDayResult(room, null);
      return;
    }

    // First-pass tie → enter DAY_TIEBREAK with just the tied targets
    // as valid choices.
    await prisma.mafiaGame.update({
      where: { id: game.id },
      data: {
        phase: MafiaPhase.DAY_TIEBREAK,
        timerEndsAt: new Date(
          Date.now() + MAFIA_DAY_TIEBREAK_DURATION_SECONDS * 1000
        ),
        tiebreakCandidateIds: topTargets
      }
    });
    this.startTimer(roomCode);
    await this.realtime.broadcastRoomState(roomCode);
  }

  private async transitionToDayResult(
    room: RoomWithMafiaState,
    eliminatedPlayerId: string | null
  ) {
    if (!room.mafiaGame) return;
    const game = room.mafiaGame;
    const dayResultDelaySeconds = getMafiaResultRevealDurationSeconds(
      room.mode,
      "DAY_RESULT"
    );
    await prisma.$transaction(async (tx) => {
      if (eliminatedPlayerId) {
        await tx.mafiaPlayerRole.update({
          where: { playerId: eliminatedPlayerId },
          data: {
            isAlive: false,
            eliminatedRound: game.dayNumber,
            eliminatedCause: MafiaEliminationCause.DAY_VOTE,
            roleRevealed: true
          }
        });
        await tx.player.update({
          where: { id: eliminatedPlayerId },
          data: { isAlive: false }
        });
      }
      await tx.mafiaGame.update({
        where: { id: game.id },
        data: {
          phase: MafiaPhase.DAY_RESULT,
          timerEndsAt: dayResultDelaySeconds
            ? new Date(Date.now() + dayResultDelaySeconds * 1000)
            : null,
          tiebreakCandidateIds: []
        }
      });
    });
    if (dayResultDelaySeconds) {
      this.startTimer(room.code);
    }
    await this.realtime.broadcastRoomState(room.code);
  }

  private async advanceFromDayResult(roomCode: string) {
    const room = await this.getRoomWithState(roomCode);
    if (!room || !room.mafiaGame) return;
    if (room.mafiaGame.phase !== MafiaPhase.DAY_RESULT) return;

    const winner = this.computeWinner(room.players);
    if (winner) {
      await this.finishGame(room, winner);
      return;
    }
    await this.advanceToNight(room.mafiaGame.id);
    await this.realtime.broadcastRoomState(roomCode);
  }

  // Host short-circuit: skip the discussion timer or force-resolve a
  // vote round. Other phases ignore the call so a stray tap during
  // animation doesn't corrupt state.
  async advancePhase(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);
    if (!room.mafiaGame) throw new Error("O'yin state topilmadi.");
    const phase = room.mafiaGame.phase;
    if (phase === MafiaPhase.ASSIGN_ROLES) {
      const aliveWithRole = room.players.filter((p) => p.mafiaRole?.isAlive);
      const allConfirmed = aliveWithRole.every(
        (p) => p.mafiaRole?.roleConfirmed === true
      );
      if (!allConfirmed) {
        throw new Error("Avval hamma rolini tasdiqlasin.");
      }
      await this.advanceToNight(room.mafiaGame.id);
    } else if (phase === MafiaPhase.NIGHT_RESULT) {
      await this.advanceFromNightResult(input.code);
    } else if (phase === MafiaPhase.DAY_DISCUSSION) {
      this.stopTimer(input.code);
      await this.advanceToDayVote(input.code);
    } else if (
      phase === MafiaPhase.DAY_VOTE ||
      phase === MafiaPhase.DAY_TIEBREAK
    ) {
      this.stopTimer(input.code);
      await this.resolveDayVote(input.code);
    } else if (phase === MafiaPhase.DAY_RESULT) {
      await this.advanceFromDayResult(input.code);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Win condition + finish
  // ────────────────────────────────────────────────────────────────

  // City wins when no mafia remain. Mafia wins when alive mafia ≥ alive
  // city — at parity they can no longer be voted out, so the city has
  // effectively lost.
  private computeWinner(
    players: RoomWithMafiaState["players"]
  ): MafiaTeam | null {
    let mafiaAlive = 0;
    let cityAlive = 0;
    for (const p of players) {
      if (!p.mafiaRole || !p.mafiaRole.isAlive) continue;
      if (p.mafiaRole.role === MafiaRole.MAFIA) mafiaAlive += 1;
      else cityAlive += 1;
    }
    if (mafiaAlive === 0) return MafiaTeam.CITY;
    if (mafiaAlive >= cityAlive) return MafiaTeam.MAFIA;
    return null;
  }

  private async finishGame(room: RoomWithMafiaState, winner: MafiaTeam) {
    if (!room.mafiaGame) return;
    this.stopTimer(room.code);
    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.FINISHED }
      }),
      prisma.mafiaGame.update({
        where: { id: room.mafiaGame.id },
        data: {
          phase: MafiaPhase.FINISHED,
          timerEndsAt: null,
          winner
        }
      }),
      // Reveal every role on the finish screen — the post-game review
      // is part of the social fun and matches the Bunker pattern.
      prisma.mafiaPlayerRole.updateMany({
        where: { gameId: room.mafiaGame.id },
        data: { roleRevealed: true }
      })
    ]);

    if (room.hostUserId) {
      await prisma.gameHistory.create({
        data: {
          userId: room.hostUserId,
          gameType: GameType.MAFIA,
          playedAt: new Date(),
          startedAt: room.mafiaGame.startedAt,
          endedAt: new Date(),
          outcome: GameOutcome.PLAYED,
          roomCode: room.code,
          playerCount: room.players.length,
          metadata: { winner }
        }
      });
    }

    await this.realtime.broadcastRoomState(room.code);
  }

  async endGame(input: RoomCodeAction) {
    const room = await this.requireHostRoom(input);
    if (!room.mafiaGame) throw new Error("O'yin state topilmadi.");
    if (room.status === RoomStatus.FINISHED || room.status === RoomStatus.CANCELLED) {
      return;
    }

    const wasLobby = room.status === RoomStatus.LOBBY;
    this.stopTimer(input.code);
    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { status: wasLobby ? RoomStatus.CANCELLED : RoomStatus.FINISHED }
      }),
      prisma.mafiaGame.update({
        where: { id: room.mafiaGame.id },
        data: { phase: MafiaPhase.FINISHED, timerEndsAt: null }
      }),
      prisma.mafiaPlayerRole.updateMany({
        where: { gameId: room.mafiaGame.id },
        data: { roleRevealed: true }
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

  async broadcastState(roomCode: string) {
    await this.realtime.broadcastRoomState(roomCode.toUpperCase());
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

    // Last-night victims — derive from the player roles eliminated this
    // night via a night-cause. Avoids denormalising onto the game model.
    const lastNightVictims = room.players
      .filter(
        (p) =>
          p.mafiaRole &&
          p.mafiaRole.eliminatedRound === game.nightNumber &&
          (p.mafiaRole.eliminatedCause === MafiaEliminationCause.MAFIA_KILL ||
            p.mafiaRole.eliminatedCause === MafiaEliminationCause.SHERIFF_SHOOT)
      )
      .map((p) => ({
        playerId: p.id,
        role: p.mafiaRole!.role
      }));

    // Mafia picks (real-time during NIGHT) — visible only to mafia members
    // so the team can see each other's targets converge. We expose every
    // mafia member's submission for the current night, even null targets
    // (so the UI renders an empty slot for teammates still picking).
    const mafiaPicks =
      myRole?.role === "MAFIA"
        ? game.nightSubmissions
            .filter(
              (s) =>
                s.nightNumber === game.nightNumber &&
                s.action === MafiaNightActionType.MAFIA_KILL
            )
            .map((s) => ({
              actorPlayerId: s.actorPlayerId,
              targetPlayerId: s.targetPlayerId
            }))
        : [];

    // Sheriff check history — every SHERIFF_CHECK submission ever made by
    // the current sheriff, joined with the target's role to determine
    // isMafia. Surfaced after submission so the sheriff sees results in
    // real-time during NIGHT, and on subsequent nights the past results
    // remain visible.
    const sheriffChecks =
      myRole?.role === "SHERIFF" && me
        ? game.nightSubmissions
            .filter(
              (s) =>
                s.actorPlayerId === me.id &&
                s.action === MafiaNightActionType.SHERIFF_CHECK &&
                s.isConfirmed &&
                s.targetPlayerId
            )
            .map((s) => {
              const target = room.players.find(
                (p) => p.id === s.targetPlayerId
              );
              return {
                playerId: s.targetPlayerId!,
                isMafia: target?.mafiaRole?.role === MafiaRole.MAFIA,
                nightNumber: s.nightNumber
              };
            })
            .sort((a, b) => a.nightNumber - b.nightNumber)
        : [];

    // Current player's submission for this night (if any) — used by the
    // UI to render the active pick / chosen sheriff mode.
    const nightSubmissionsThisRound =
      game.phase === MafiaPhase.NIGHT
        ? game.nightSubmissions.filter(
            (s) => s.nightNumber === game.nightNumber
          )
        : [];
    const myCurrentSub = me
      ? game.nightSubmissions.find(
          (s) =>
            s.actorPlayerId === me.id && s.nightNumber === game.nightNumber
        ) ?? null
      : null;

    // Day vote tally — only the count and "submitted-by-me" flag are
    // exposed publicly. The targets aren't surfaced live so a vote
    // can't be coerced by who's already in the lead. The reveal
    // happens at DAY_RESULT.
    const isVotePhase =
      game.phase === MafiaPhase.DAY_VOTE ||
      game.phase === MafiaPhase.DAY_TIEBREAK;
    const isTiebreakRound = game.phase === MafiaPhase.DAY_TIEBREAK;
    const eligibleDayVoters = isVotePhase
      ? this.getDayVoteEligibleVoters(room.players, game)
      : [];
    const dayVotesThisRound = isVotePhase
      ? game.dayVotes.filter(
          (v) =>
            v.dayNumber === game.dayNumber && v.isTiebreak === isTiebreakRound
        )
      : [];
    const myDayVote =
      me != null
        ? dayVotesThisRound.find((v) => v.voterPlayerId === me.id) ?? null
        : null;
    const submittedByMe = myDayVote != null;
    const voteConfirmedCount = dayVotesThisRound.filter(
      (v) => v.isConfirmed
    ).length;

    // Last day-vote elimination — for the DAY_RESULT screen. Like the
    // night-victims derivation, we read it off MafiaPlayerRole rows.
    const dayEliminated = room.players.find(
      (p) =>
        p.mafiaRole?.eliminatedCause === MafiaEliminationCause.DAY_VOTE &&
        p.mafiaRole?.eliminatedRound === game.dayNumber
    );
    const winnerPreview =
      game.phase === MafiaPhase.DAY_RESULT
        ? this.computeWinner(room.players) ?? game.winner
        : game.winner;

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
        winner: winnerPreview,
        lastNightVictims,
        lastNightDoctorSaved: game.lastNightDoctorSaved,
        lastEliminatedPlayerId: dayEliminated?.id ?? null,
        lastEliminatedRole: dayEliminated?.mafiaRole?.role ?? null,
        tiebreakCandidateIds: game.tiebreakCandidateIds
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
            sheriffChecks,
            citizenQuestion: myCurrentSub?.citizenQuestion ?? null,
            pendingNightTargetId: myCurrentSub?.targetPlayerId ?? null,
            pendingNightAction: myCurrentSub?.action ?? null,
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
          winnerPreview != null ||
          (myRole?.role === "MAFIA" && p.mafiaRole?.role === "MAFIA");
        return {
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          isAlive: p.isAlive,
          readyAt: p.readyAt ? p.readyAt.toISOString() : null,
          online: isOnline,
          seatOrder: p.seatOrder,
          revealedRole: showRole ? p.mafiaRole?.role ?? null : null
        };
      }),
      mafiaPicks,
      night: {
        submittedByMe: (myCurrentSub?.targetPlayerId ?? null) !== null,
        confirmedByMe: myCurrentSub?.isConfirmed ?? false,
        confirmations: {
          confirmed: nightSubmissionsThisRound.filter((s) => s.isConfirmed).length,
          total: room.players.filter((p) => p.mafiaRole?.isAlive).length
        }
      },
      votes: {
        total: dayVotesThisRound.length,
        submittedByMe,
        myTargetPlayerId: myDayVote?.targetPlayerId ?? null,
        confirmedByMe: myDayVote?.isConfirmed ?? false,
        confirmations: {
          confirmed: voteConfirmedCount,
          total: eligibleDayVoters.length
        }
      }
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
        mafiaGame: {
          include: { nightSubmissions: true, dayVotes: true }
        }
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

  private getDayVoteEligibleVoters(
    players: RoomWithMafiaState["players"],
    game: RoomWithMafiaState["mafiaGame"]
  ) {
    const alivePlayers = players.filter((p) => p.mafiaRole?.isAlive);
    if (!game || game.phase !== MafiaPhase.DAY_TIEBREAK) {
      return alivePlayers;
    }

    const tiebreakCandidates = game.tiebreakCandidateIds;
    const allAliveAreTied =
      alivePlayers.length > 0 &&
      alivePlayers.every((player) => tiebreakCandidates.includes(player.id));
    if (allAliveAreTied) return alivePlayers;

    return alivePlayers.filter(
      (player) => !tiebreakCandidates.includes(player.id)
    );
  }

  // 1Hz tick — broadcasts the remaining seconds to clients and triggers
  // phase resolution when the deadline elapses. Same shape as Bunker's
  // timer so the client only listens to one `timer_update` event type.
  private startTimer(roomCode: string) {
    this.stopTimer(roomCode);
    const code = roomCode.toUpperCase();

    const interval = setInterval(async () => {
      try {
        const room = await prisma.room.findUnique({
          where: { code },
          include: { mafiaGame: true }
        });
        if (!room?.mafiaGame?.timerEndsAt) {
          this.stopTimer(code);
          return;
        }
        const remaining = this.getRemainingSeconds(room.mafiaGame.timerEndsAt);
        this.realtime.broadcastTimer(code, remaining);
        if (remaining > 0) return;

        this.stopTimer(code);
        const phase = room.mafiaGame.phase;
        if (phase === MafiaPhase.NIGHT) {
          await this.resolveNight(code);
        } else if (phase === MafiaPhase.NIGHT_RESULT) {
          await this.advanceFromNightResult(code);
        } else if (phase === MafiaPhase.DAY_DISCUSSION) {
          await this.advanceToDayVote(code);
        } else if (
          phase === MafiaPhase.DAY_VOTE ||
          phase === MafiaPhase.DAY_TIEBREAK
        ) {
          await this.resolveDayVote(code);
        } else if (phase === MafiaPhase.DAY_RESULT) {
          await this.advanceFromDayResult(code);
        }
      } catch (error) {
        console.error(error);
        this.stopTimer(code);
      }
    }, 1000);

    this.timers.set(code, interval);
  }

  private stopTimer(roomCode: string) {
    const code = roomCode.toUpperCase();
    const timer = this.timers.get(code);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(code);
    }
  }
}
