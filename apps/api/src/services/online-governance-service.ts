import crypto from "node:crypto";

import { getRedis } from "../lib/redis";

export type OnlineProposalKind = "END_GAME" | "KICK";

export type OnlineProposal = {
  id: string;
  kind: OnlineProposalKind;
  proposerPlayerId: string;
  proposerName: string;
  targetPlayerId: string | null;
  targetName: string | null;
  eligiblePlayerIds: string[];
  approvals: string[];
  rejections: string[];
  createdAt: string;
  majority: number;
};

export type OnlineGovernanceState = {
  endGameProposal: OnlineProposal | null;
  kickProposal: OnlineProposal | null;
};

type VoteResult =
  | { status: "pending"; proposal: OnlineProposal }
  | { status: "passed"; proposal: OnlineProposal }
  | { status: "rejected"; proposal: OnlineProposal };

const PREFIX = "online_governance:";
const TTL_SECONDS = 15 * 60;

function key(roomCode: string) {
  return `${PREFIX}${roomCode.toUpperCase()}`;
}

async function read(roomCode: string): Promise<OnlineGovernanceState> {
  const raw = await getRedis().get(key(roomCode));
  if (!raw) return { endGameProposal: null, kickProposal: null };
  try {
    return JSON.parse(raw) as OnlineGovernanceState;
  } catch {
    return { endGameProposal: null, kickProposal: null };
  }
}

async function write(roomCode: string, state: OnlineGovernanceState) {
  await getRedis().set(key(roomCode), JSON.stringify(state), "EX", TTL_SECONDS);
}

function slotName(kind: OnlineProposalKind) {
  return kind === "END_GAME" ? "endGameProposal" : "kickProposal";
}

function majorityFor(eligiblePlayerIds: string[]) {
  return Math.floor(eligiblePlayerIds.length / 2) + 1;
}

export const onlineGovernanceService = {
  async getState(roomCode: string): Promise<OnlineGovernanceState> {
    return read(roomCode);
  },

  async clearRoom(roomCode: string): Promise<void> {
    await getRedis().del(key(roomCode));
  },

  async clearProposal(roomCode: string, kind: OnlineProposalKind): Promise<void> {
    const state = await read(roomCode);
    state[slotName(kind)] = null;
    await write(roomCode, state);
  },

  async createProposal(input: {
    roomCode: string;
    kind: OnlineProposalKind;
    proposerPlayerId: string;
    proposerName: string;
    targetPlayerId?: string | null;
    targetName?: string | null;
    eligiblePlayerIds: string[];
  }): Promise<OnlineProposal> {
    const state = await read(input.roomCode);
    const slot = slotName(input.kind);
    if (state[slot]) {
      throw new Error(
        input.kind === "END_GAME"
          ? "O'yinni tugatish bo'yicha ovoz allaqachon ochilgan."
          : "Bu o'yinchi bo'yicha kick ovozi allaqachon ochilgan."
      );
    }

    const proposal: OnlineProposal = {
      id: crypto.randomUUID(),
      kind: input.kind,
      proposerPlayerId: input.proposerPlayerId,
      proposerName: input.proposerName,
      targetPlayerId: input.targetPlayerId ?? null,
      targetName: input.targetName ?? null,
      eligiblePlayerIds: input.eligiblePlayerIds,
      approvals: [input.proposerPlayerId],
      rejections: [],
      createdAt: new Date().toISOString(),
      majority: majorityFor(input.eligiblePlayerIds)
    };

    state[slot] = proposal;
    await write(input.roomCode, state);
    return proposal;
  },

  async vote(input: {
    roomCode: string;
    kind: OnlineProposalKind;
    proposalId: string;
    playerId: string;
    approve: boolean;
  }): Promise<VoteResult> {
    const state = await read(input.roomCode);
    const slot = slotName(input.kind);
    const proposal = state[slot];
    if (!proposal || proposal.id !== input.proposalId) {
      throw new Error("Ovoz berish sessiyasi topilmadi.");
    }
    if (!proposal.eligiblePlayerIds.includes(input.playerId)) {
      throw new Error("Siz bu ovozda qatnasha olmaysiz.");
    }

    proposal.approvals = proposal.approvals.filter((id) => id !== input.playerId);
    proposal.rejections = proposal.rejections.filter((id) => id !== input.playerId);

    if (input.approve) {
      proposal.approvals.push(input.playerId);
    } else {
      proposal.rejections.push(input.playerId);
    }

    if (proposal.approvals.length >= proposal.majority) {
      state[slot] = null;
      await write(input.roomCode, state);
      return { status: "passed", proposal };
    }

    if (proposal.rejections.length >= proposal.majority) {
      state[slot] = null;
      await write(input.roomCode, state);
      return { status: "rejected", proposal };
    }

    state[slot] = proposal;
    await write(input.roomCode, state);
    return { status: "pending", proposal };
  }
};
