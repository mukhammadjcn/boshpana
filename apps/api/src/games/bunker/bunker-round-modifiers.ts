import type { Prisma } from "@prisma/client";

// BunkerGame.roundModifiers JSON shakli.
// Bitta joyda boshqarish — har bir effekt funksiyasi shu yerda qo'shadi/o'qiydi.
export type RoundModifiers = {
  // Bu raundda haydab bo'lmaydigan o'yinchilar.
  immune: string[];
  // Ovozi 2 ga teng o'yinchilar (player ID array).
  doubleVote: string[];
  // Muhokama/ovoz bermaslik majburiyati ostidagi o'yinchilar (silence).
  silenced: string[];
  // Raunda qatnashmaydigan (skip qiluvchi) o'yinchilar.
  skipRound: string[];
  // Ovoz boshlanishidan oldin auto-qarshi ovozlar: { playerId: count }.
  extraVotesAgainst: Record<string, number>;
};

const EMPTY: RoundModifiers = {
  immune: [],
  doubleVote: [],
  silenced: [],
  skipRound: [],
  extraVotesAgainst: {}
};

/**
 * JSON'dan to'liq RoundModifiers'ni o'qiydi, har qanday yo'q field uchun default beradi.
 * Eski o'yinlarda boshlang'ich `{}` uchun ham xavfsiz.
 */
export function parseRoundModifiers(raw: Prisma.JsonValue | null | undefined): RoundModifiers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY };
  const obj = raw as Record<string, unknown>;
  return {
    immune: asStringArray(obj.immune),
    doubleVote: asStringArray(obj.doubleVote),
    silenced: asStringArray(obj.silenced),
    skipRound: asStringArray(obj.skipRound),
    extraVotesAgainst: asStringNumberMap(obj.extraVotesAgainst)
  };
}

export function emptyRoundModifiers(): RoundModifiers {
  return { ...EMPTY };
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asStringNumberMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number") out[k] = val;
  }
  return out;
}
