import type { BunkerActionEffect, Prisma, PrismaClient } from "@prisma/client";

// Yagona reducer — har bir effekt o'z funksiyasiga ega.
// Faza 3 da hamma effektlar NO-OP (faqat instanceni PLAYED holatga o'tkazadi).
// Faza 4-6 da har bir effekt switch ichida bittadan ishlovga olinadi.

type Tx =
  | PrismaClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type PlayActionInput = {
  tx: Tx;
  gameId: string;
  instanceId: string;
  // Karta ishlatuvchi o'yinchi.
  sourcePlayerId: string;
  // Maqsadli o'yinchi (SELF effektlarda null/undefined).
  targetPlayerId?: string | null;
};

export type PlayActionResult = {
  effect: BunkerActionEffect;
  // Frontend uchun animatsiya/UI hint. Mantiq tegishli ma'lumotni keyinchalik to'ldiradi.
  resultMeta: Prisma.InputJsonValue;
};

/**
 * Markaziy "switch" — bitta joyda, mavjud game-service kodiga aralashmaydi.
 *
 * NO-OP semantics (Faza 3):
 *   - Instance HELD bo'lsa PLAYED ga o'tkaziladi (audit uchun saqlanadi).
 *   - Hech qanday o'yin state'i o'zgarmaydi (cards, votes, modifiers).
 *   - resultMeta bo'sh, frontend faqat "ishlatildi" animatsiyasini ko'rsatadi.
 *
 * Faza 4 da V1 effektlar (IMMUNITY_THIS_ROUND, DOUBLE_VOTE_THIS_ROUND, va h.k.)
 * shu joyda bittadan implement qilinadi.
 */
export async function applyActionEffect(
  input: PlayActionInput
): Promise<PlayActionResult> {
  const { tx, instanceId, sourcePlayerId, targetPlayerId } = input;

  // Karta nusxasini olish va validatsiya
  const instance = await tx.bunkerActionCardInstance.findUnique({
    where: { id: instanceId },
    include: { actionCard: true }
  });
  if (!instance) {
    throw new Error("Maxsus karta topilmadi.");
  }
  if (instance.playerId !== sourcePlayerId) {
    throw new Error("Bu karta sizniki emas.");
  }
  if (instance.status !== "HELD") {
    throw new Error("Bu karta allaqachon ishlatilgan.");
  }

  const effect = instance.actionCard.effect;
  const targetScope = instance.actionCard.targetScope;

  // Target scope validatsiyasi
  if (targetScope === "SELF" && targetPlayerId && targetPlayerId !== sourcePlayerId) {
    throw new Error("Bu karta faqat o'ziga ishlatiladi.");
  }
  if (targetScope === "OTHER") {
    if (!targetPlayerId) {
      throw new Error("Target o'yinchi tanlanmagan.");
    }
    if (targetPlayerId === sourcePlayerId) {
      throw new Error("Bu kartani o'zingizga ishlatish mumkin emas.");
    }
  }
  if (targetScope === "ANY" && !targetPlayerId) {
    throw new Error("Target o'yinchi tanlanmagan.");
  }

  // Faza 3: hech qanday effekt mantiqi yo'q, faqat instance status yangilanadi.
  // Switch keyingi fazalarda to'ldiriladi.
  const resultMeta: Prisma.InputJsonValue = await runEffect(input, effect);

  await tx.bunkerActionCardInstance.update({
    where: { id: instanceId },
    data: {
      status: "PLAYED",
      playedAt: new Date(),
      targetPlayerId: targetPlayerId ?? null,
      resultMeta
    }
  });

  return { effect, resultMeta };
}

async function runEffect(
  _input: PlayActionInput,
  effect: BunkerActionEffect
): Promise<Prisma.InputJsonValue> {
  // Har bir case Faza 4-6 da to'ldiriladi. Hozircha barchasi NO-OP.
  switch (effect) {
    case "IMMUNITY_THIS_ROUND":
    case "DOUBLE_VOTE_THIS_ROUND":
    case "EXTRA_BAGGAGE":
    case "SKIP_THIS_ROUND":
    case "REPLACE_OWN_HEALTH":
    case "REPLACE_OWN_BIOLOGY":
    case "REPLACE_OTHER_HEALTH":
    case "REPLACE_OTHER_FACT":
    case "REPLACE_OTHER_PROFESSION":
    case "STEAL_BAGGAGE":
    case "REVEAL_HIDDEN_CARD":
    case "SILENCE_PLAYER":
    case "EXTRA_VOTES_AGAINST":
    case "REDIRECT_VOTES":
    case "INSTANT_EXILE":
    case "CANCEL_ROUND_VOTES":
    case "REVIVE_SELF":
    case "FORCE_REVEAL_ALL_OWN":
    case "REROLL_TARGET_CARD":
    case "STEAL_GOOD_GIVE_BAD":
      return { noop: true, phase: "skeleton" };
    default: {
      // Exhaustive check — yangi enum qiymati qo'shilsa TS xato beradi.
      const _exhaustive: never = effect;
      throw new Error(`Noma'lum effekt: ${String(_exhaustive)}`);
    }
  }
}
