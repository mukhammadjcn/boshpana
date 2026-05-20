import { BunkerCardType, type BunkerActionEffect, type Prisma, type PrismaClient } from "@prisma/client";

import {
  parseRoundModifiers,
  type RoundModifiers
} from "./bunker-round-modifiers";

// Yagona reducer — har bir effekt o'z funksiyasiga ega.
// Faza 4 da V1 effektlar bittadan haqiqiy mantiqqa ega bo'ladi.
// V2/V3 hali NO-OP (Faza 5-6 da yoqiladi).

type Tx =
  | PrismaClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// Modifierni o'qib, mutator chaqirib, qaytib yozish — atomar (tx ichida ishlatamiz).
async function mutateRoundModifiers(
  tx: Tx,
  gameId: string,
  mutator: (mods: RoundModifiers) => void
): Promise<void> {
  const game = await tx.bunkerGame.findUnique({
    where: { id: gameId },
    select: { roundModifiers: true }
  });
  if (!game) throw new Error("O'yin topilmadi.");
  const mods = parseRoundModifiers(game.roundModifiers);
  mutator(mods);
  await tx.bunkerGame.update({
    where: { id: gameId },
    data: { roundModifiers: mods as unknown as Prisma.InputJsonValue }
  });
}

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
  input: PlayActionInput,
  effect: BunkerActionEffect
): Promise<Prisma.InputJsonValue> {
  const { tx, gameId, sourcePlayerId } = input;

  switch (effect) {
    // ─── V1 ─────────────────────────────────────────────────────
    case "IMMUNITY_THIS_ROUND": {
      // Bu raundda haydab bo'lmaydigan o'yinchilar ro'yxatiga qo'shamiz.
      await mutateRoundModifiers(tx, gameId, (mods) => {
        if (!mods.immune.includes(sourcePlayerId)) {
          mods.immune.push(sourcePlayerId);
        }
      });
      return { applied: "immunity", playerId: sourcePlayerId };
    }

    case "DOUBLE_VOTE_THIS_ROUND": {
      await mutateRoundModifiers(tx, gameId, (mods) => {
        if (!mods.doubleVote.includes(sourcePlayerId)) {
          mods.doubleVote.push(sourcePlayerId);
        }
      });
      return { applied: "double_vote", playerId: sourcePlayerId };
    }

    case "SKIP_THIS_ROUND": {
      await mutateRoundModifiers(tx, gameId, (mods) => {
        if (!mods.skipRound.includes(sourcePlayerId)) {
          mods.skipRound.push(sourcePlayerId);
        }
        // Skip qilgan o'yinchi ham ovoz bera olmasin — auto-silence.
        if (!mods.silenced.includes(sourcePlayerId)) {
          mods.silenced.push(sourcePlayerId);
        }
        // Skip = ovoz qabul qilmaydi (auto immunity).
        if (!mods.immune.includes(sourcePlayerId)) {
          mods.immune.push(sourcePlayerId);
        }
      });
      return { applied: "skip_round", playerId: sourcePlayerId };
    }

    case "REPLACE_OWN_HEALTH": {
      const newText = await drawReplacement(tx, gameId, "HEALTH");
      const prev = await tx.bunkerPlayerAttribute.findUnique({
        where: { playerId: sourcePlayerId },
        select: { health: true }
      });
      await tx.bunkerPlayerAttribute.update({
        where: { playerId: sourcePlayerId },
        data: { health: newText }
      });
      return { applied: "replace_health", from: prev?.health ?? null, to: newText };
    }

    case "REPLACE_OWN_BIOLOGY": {
      const newText = await drawReplacement(tx, gameId, "BIOLOGY");
      const prev = await tx.bunkerPlayerAttribute.findUnique({
        where: { playerId: sourcePlayerId },
        select: { biology: true }
      });
      await tx.bunkerPlayerAttribute.update({
        where: { playerId: sourcePlayerId },
        data: { biology: newText }
      });
      return { applied: "replace_biology", from: prev?.biology ?? null, to: newText };
    }

    case "EXTRA_BAGGAGE": {
      // Bagaj ustuni bitta matn — qo'shimcha bagaj uchun ikkinchi slot yo'q.
      // Hozircha: yangi bagaj kartani torttiramiz va eskisiga ustiga yozamiz
      // bo'lmaydi — chunki o'yinchi haqiqiy "qo'shimcha bagaj" kutadi.
      // Faza 5 da BunkerPlayerExtraBaggage jadvali qo'shamiz; hozircha
      // yangi bagajni reveal qilingan ro'yxatga qo'shib, eski bagajni saqlaymiz.
      // Vaqtincha yechim: yangi bagaj kartasini tortib, "extraBaggage" sifatida
      // resultMeta'da qaytaramiz. UI keyinroq alohida ko'rsatadi.
      const newText = await drawReplacement(tx, gameId, "BAGGAGE");
      return { applied: "extra_baggage", baggage: newText, note: "schema_extension_pending" };
    }

    // ─── V2 ─────────────────────────────────────────────────────
    case "REPLACE_OTHER_HEALTH": {
      const targetId = requireTarget(input.targetPlayerId);
      const newText = await drawReplacement(tx, gameId, "HEALTH");
      const prev = await tx.bunkerPlayerAttribute.findUnique({
        where: { playerId: targetId },
        select: { health: true }
      });
      await tx.bunkerPlayerAttribute.update({
        where: { playerId: targetId },
        data: { health: newText }
      });
      return {
        applied: "replace_other_health",
        targetPlayerId: targetId,
        from: prev?.health ?? null,
        to: newText
      };
    }

    case "SILENCE_PLAYER": {
      const targetId = requireTarget(input.targetPlayerId);
      await mutateRoundModifiers(tx, gameId, (mods) => {
        if (!mods.silenced.includes(targetId)) mods.silenced.push(targetId);
      });
      return { applied: "silence_player", targetPlayerId: targetId };
    }

    case "EXTRA_VOTES_AGAINST": {
      const targetId = requireTarget(input.targetPlayerId);
      await mutateRoundModifiers(tx, gameId, (mods) => {
        mods.extraVotesAgainst[targetId] =
          (mods.extraVotesAgainst[targetId] ?? 0) + 2;
      });
      return { applied: "extra_votes_against", targetPlayerId: targetId, count: 2 };
    }

    case "REPLACE_OTHER_FACT": {
      const targetId = requireTarget(input.targetPlayerId);
      const newText = await drawReplacement(tx, gameId, "FACT");
      const prev = await tx.bunkerPlayerAttribute.findUnique({
        where: { playerId: targetId },
        select: { fact: true }
      });
      await tx.bunkerPlayerAttribute.update({
        where: { playerId: targetId },
        data: { fact: newText }
      });
      return {
        applied: "replace_other_fact",
        targetPlayerId: targetId,
        from: prev?.fact ?? null,
        to: newText
      };
    }

    case "REPLACE_OTHER_PROFESSION": {
      const targetId = requireTarget(input.targetPlayerId);
      const newText = await drawReplacement(tx, gameId, "PROFESSION");
      const prev = await tx.bunkerPlayerAttribute.findUnique({
        where: { playerId: targetId },
        select: { profession: true }
      });
      await tx.bunkerPlayerAttribute.update({
        where: { playerId: targetId },
        data: { profession: newText }
      });
      return {
        applied: "replace_other_profession",
        targetPlayerId: targetId,
        from: prev?.profession ?? null,
        to: newText
      };
    }

    case "REVEAL_HIDDEN_CARD": {
      // Shantaj: target o'yinchining hali ochilmagan kartalaridan birini
      // majburan ochiramiz (server tasodifiy tanlaydi). Faza 7'da target
      // tanlangach attacker karta turini tanlash imkoniyati qo'shiladi.
      const targetId = requireTarget(input.targetPlayerId);
      const attrs = await tx.bunkerPlayerAttribute.findUnique({
        where: { playerId: targetId },
        select: { revealed: true }
      });
      if (!attrs) throw new Error("Target o'yinchining kartalari topilmadi.");
      const allTypes: BunkerCardType[] = [
        BunkerCardType.PROFESSION,
        BunkerCardType.HEALTH,
        BunkerCardType.BIOLOGY,
        BunkerCardType.SKILL,
        BunkerCardType.BAGGAGE,
        BunkerCardType.FACT
      ];
      const hidden = allTypes.filter((t) => !attrs.revealed.includes(t));
      if (hidden.length === 0) {
        return { applied: "reveal_hidden_card", targetPlayerId: targetId, note: "no_hidden_cards" };
      }
      const picked = hidden[Math.floor(Math.random() * hidden.length)];
      await tx.bunkerPlayerAttribute.update({
        where: { playerId: targetId },
        data: { revealed: { push: picked } }
      });
      return {
        applied: "reveal_hidden_card",
        targetPlayerId: targetId,
        revealedType: picked
      };
    }

    // ─── V2/V3 hali NO-OP ──────────────────────────────────────
    case "STEAL_BAGGAGE":
    case "REDIRECT_VOTES":
    case "INSTANT_EXILE":
    case "CANCEL_ROUND_VOTES":
    case "REVIVE_SELF":
    case "FORCE_REVEAL_ALL_OWN":
    case "REROLL_TARGET_CARD":
    case "STEAL_GOOD_GIVE_BAD":
      return { noop: true, phase: "skeleton" };

    default: {
      const _exhaustive: never = effect;
      throw new Error(`Noma'lum effekt: ${String(_exhaustive)}`);
    }
  }
}

function requireTarget(targetPlayerId: string | null | undefined): string {
  if (!targetPlayerId) {
    throw new Error("Bu karta uchun maqsadli o'yinchi tanlanishi kerak.");
  }
  return targetPlayerId;
}

/**
 * Belgilangan typedan tasodifiy karta tortish — o'yinchining hozirgi
 * kartasi bilan bir xil bo'lmasin (qachondir). Pool kichik bo'lsa,
 * faqat bittasi qolsa, o'sha kartani qaytaradi.
 */
async function drawReplacement(
  tx: Tx,
  gameId: string,
  type: "HEALTH" | "BIOLOGY" | "BAGGAGE" | "PROFESSION" | "FACT" | "SKILL"
): Promise<string> {
  const game = await tx.bunkerGame.findUnique({
    where: { id: gameId },
    select: { room: { select: { isAdult: true } } }
  });
  const isAdult = game?.room?.isAdult ?? false;
  const pool = await tx.bunkerCard.findMany({
    where: { type, ...(isAdult ? {} : { isAdult: false }) },
    select: { text: true }
  });
  if (pool.length === 0) throw new Error(`${type} kartalar hovuzi bo'sh.`);
  return pool[Math.floor(Math.random() * pool.length)].text;
}
