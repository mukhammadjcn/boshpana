import crypto from "node:crypto";

import { getRedis } from "../lib/redis";

export type OnlineProposalKind = "END_GAME" | "KICK" | "SKIP_TO_VOTE";

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
  skipToVoteProposal: OnlineProposal | null;
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
  if (!raw)
    return {
      endGameProposal: null,
      kickProposal: null,
      skipToVoteProposal: null
    };
  try {
    return JSON.parse(raw) as OnlineGovernanceState;
  } catch {
    return {
      endGameProposal: null,
      kickProposal: null,
      skipToVoteProposal: null
    };
  }
}

async function write(roomCode: string, state: OnlineGovernanceState) {
  await getRedis().set(key(roomCode), JSON.stringify(state), "EX", TTL_SECONDS);
}

function slotName(kind: OnlineProposalKind) {
  if (kind === "END_GAME") return "endGameProposal";
  if (kind === "SKIP_TO_VOTE") return "skipToVoteProposal";
  return "kickProposal";
}

// END_GAME / KICK pass on a simple majority. SKIP_TO_VOTE is different:
// jumping the table straight to voting silences everyone still talking,
// so it only passes when EVERY eligible (alive) player agrees. If even
// one refuses, the round just waits for the discussion timer instead.
function passThresholdFor(
  kind: OnlineProposalKind,
  eligiblePlayerIds: string[]
) {
  if (kind === "SKIP_TO_VOTE") return eligiblePlayerIds.length;
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
          : input.kind === "SKIP_TO_VOTE"
            ? "Ovoz berishga o'tish bo'yicha taklif allaqachon ochilgan."
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
      majority: passThresholdFor(input.kind, input.eligiblePlayerIds)
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

    // SKIP_TO_VOTE needs unanimous approval, so a single "no" already
    // makes it impossible — cancel immediately instead of leaving a dead
    // proposal on screen. END_GAME / KICK still need a rejecting majority.
    const rejectThreshold =
      proposal.kind === "SKIP_TO_VOTE" ? 1 : proposal.majority;
    if (proposal.rejections.length >= rejectThreshold) {
      state[slot] = null;
      await write(input.roomCode, state);
      return { status: "rejected", proposal };
    }

    state[slot] = proposal;
    await write(input.roomCode, state);
    return { status: "pending", proposal };
  }
};
