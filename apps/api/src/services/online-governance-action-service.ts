import { Prisma, RoomMode, RoomStatus } from "@prisma/client";

import { GameRegistry } from "../games/registry";
import { prisma } from "../lib/prisma";
import {
  onlineGovernanceService,
  type OnlineProposal,
  type OnlineProposalKind
} from "./online-governance-service";

export type CreatorChangedPayload = {
  roomCode: string;
  previousHostSessionId: string;
  nextHostSessionId: string;
  nextHostPlayerId: string;
};

export type OnlineGovernanceActionResult = {
  roomCode: string;
  creatorChanged?: CreatorChangedPayload | null;
};

type RoomWithPlayers = Prisma.RoomGetPayload<{
  include: { players: true };
}>;

type OnlineActor = {
  room: RoomWithPlayers;
  actor: RoomWithPlayers["players"][number];
};

const ACTIVE_ROOM_STATUSES: ReadonlySet<RoomStatus> = new Set([
  RoomStatus.LOBBY,
  RoomStatus.PLAYING
]);

export function getEligibleOnlineProposalPlayerIds(
  status: RoomStatus,
  players: Array<{ id: string; isAlive: boolean }>
): string[] {
  return status === RoomStatus.LOBBY
    ? players.map((player) => player.id)
    : players.filter((player) => player.isAlive).map((player) => player.id);
}

export class OnlineGovernanceActionService {
  constructor(private readonly games: GameRegistry) {}

  async requestEndGameVote(input: {
    roomCode: string;
    sessionId: string;
  }): Promise<OnlineGovernanceActionResult> {
    const { room, actor } = await this.requireOnlineActor(input);
    this.requireAliveActorInPlayingRoom(room, actor);

    const proposal = await onlineGovernanceService.createProposal({
      roomCode: room.code,
      kind: "END_GAME",
      proposerPlayerId: actor.id,
      proposerName: actor.name,
      eligiblePlayerIds: this.eligiblePlayerIds(room)
    });

    return this.applyImmediatePass(room, "END_GAME", proposal);
  }

  async voteEndGame(input: {
    roomCode: string;
    sessionId: string;
    proposalId: string;
    approve: boolean;
  }): Promise<OnlineGovernanceActionResult> {
    const { room, actor } = await this.requireOnlineActor(input);
    const result = await onlineGovernanceService.vote({
      roomCode: room.code,
      kind: "END_GAME",
      proposalId: input.proposalId,
      playerId: actor.id,
      approve: input.approve
    });

    if (result.status !== "passed") {
      return { roomCode: room.code };
    }

    return this.endGame(room);
  }

  async requestKickVote(input: {
    roomCode: string;
    sessionId: string;
    targetPlayerId: string;
  }): Promise<OnlineGovernanceActionResult> {
    const { room, actor } = await this.requireOnlineActor(input);
    const target = room.players.find(
      (player) => player.id === input.targetPlayerId
    );

    if (!target) throw new Error("O'yinchi topilmadi.");
    if (actor.id === target.id) {
      throw new Error("O'zingizga kick ovozi ocholmaysiz.");
    }
    if (room.status === RoomStatus.PLAYING) {
      if (!actor.isAlive) {
        throw new Error("Faqat tirik o'yinchi kick ovozini boshlay oladi.");
      }
      if (!target.isAlive) {
        throw new Error("Bu o'yinchi allaqachon o'yindan chiqqan.");
      }
    }

    const proposal = await onlineGovernanceService.createProposal({
      roomCode: room.code,
      kind: "KICK",
      proposerPlayerId: actor.id,
      proposerName: actor.name,
      targetPlayerId: target.id,
      targetName: target.name,
      eligiblePlayerIds: this.eligiblePlayerIds(room)
    });

    return this.applyImmediatePass(room, "KICK", proposal);
  }

  async voteKick(input: {
    roomCode: string;
    sessionId: string;
    proposalId: string;
    approve: boolean;
  }): Promise<OnlineGovernanceActionResult> {
    const { room, actor } = await this.requireOnlineActor(input);
    const result = await onlineGovernanceService.vote({
      roomCode: room.code,
      kind: "KICK",
      proposalId: input.proposalId,
      playerId: actor.id,
      approve: input.approve
    });

    if (result.status !== "passed") {
      return { roomCode: room.code };
    }
    if (!result.proposal.targetPlayerId) {
      throw new Error("Kick qilinadigan o'yinchi topilmadi.");
    }

    return this.kickPlayer(room, result.proposal.targetPlayerId);
  }

  private async requireOnlineActor(input: {
    roomCode: string;
    sessionId: string;
  }): Promise<OnlineActor> {
    const room = await prisma.room.findUnique({
      where: { code: input.roomCode.toUpperCase() },
      include: { players: true }
    });

    if (!room) throw new Error("Room topilmadi.");
    if (room.mode !== RoomMode.ONLINE) {
      throw new Error("Bu amal faqat online roomlarda ishlaydi.");
    }
    if (!ACTIVE_ROOM_STATUSES.has(room.status)) {
      throw new Error("Bu online xona faol emas.");
    }

    const actor = room.players.find(
      (player) => player.sessionId === input.sessionId
    );
    if (!actor) throw new Error("O'yinchi topilmadi.");

    return { room, actor };
  }

  private requireAliveActorInPlayingRoom(
    room: RoomWithPlayers,
    actor: RoomWithPlayers["players"][number]
  ) {
    if (room.status === RoomStatus.PLAYING && !actor.isAlive) {
      throw new Error("Faqat tirik o'yinchi ovoz boshlay oladi.");
    }
  }

  private eligiblePlayerIds(room: RoomWithPlayers): string[] {
    const eligible = getEligibleOnlineProposalPlayerIds(
      room.status,
      room.players
    );
    if (eligible.length === 0) {
      throw new Error("Ovoz beradigan aktiv o'yinchi topilmadi.");
    }
    return eligible;
  }

  private async applyImmediatePass(
    room: RoomWithPlayers,
    kind: OnlineProposalKind,
    proposal: OnlineProposal
  ): Promise<OnlineGovernanceActionResult> {
    if (proposal.approvals.length < proposal.majority) {
      return { roomCode: room.code };
    }

    await onlineGovernanceService.clearProposal(room.code, kind);
    return kind === "END_GAME"
      ? this.endGame(room)
      : this.kickPlayer(room, proposal.targetPlayerId);
  }

  private async endGame(
    room: RoomWithPlayers
  ): Promise<OnlineGovernanceActionResult> {
    const service = this.games.for(room.gameType);
    await service.endGame({
      code: room.code,
      sessionId: room.hostSessionId
    });
    return { roomCode: room.code };
  }

  private async kickPlayer(
    room: RoomWithPlayers,
    targetPlayerId: string | null
  ): Promise<OnlineGovernanceActionResult> {
    if (!targetPlayerId) {
      throw new Error("Kick qilinadigan o'yinchi topilmadi.");
    }

    const target = room.players.find((player) => player.id === targetPlayerId);
    if (!target) {
      throw new Error("Kick qilinadigan o'yinchi topilmadi.");
    }

    const service = this.games.for(room.gameType);
    const result = await service.leaveRoom({
      code: room.code,
      sessionId: target.sessionId
    });

    return {
      roomCode: room.code,
      creatorChanged: extractCreatorChangedPayload(result)
    };
  }
}

function extractCreatorChangedPayload(
  value: unknown
): CreatorChangedPayload | null {
  if (!value || typeof value !== "object" || !("creatorChanged" in value)) {
    return null;
  }
  const payload = (value as { creatorChanged?: CreatorChangedPayload | null })
    .creatorChanged;
  return payload ?? null;
}
