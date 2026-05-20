import { BunkerPhase, type Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { withRoomActionLock } from "../../services/room-action-lock-service";
import { applyActionEffect } from "./bunker-action-effects";

// Har bir o'yinchiga tarqatiladigan action card soni. Hozircha qotirilgan;
// keyinchalik xona sozlamalariga ko'chirish mumkin.
const ACTION_CARDS_PER_PLAYER = 1;

type Tx =
  | PrismaClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Tarqatish strategiyasi: faqat `enabled=true` kartalardan random tanlash,
 * isAdult filter, va bir o'yinchiga bir xil karta tushmasligi (key bo'yicha unique).
 *
 * Faza 4-6 davomida yangi effektlar `enabled=true` qilinishi bilan
 * tarqatish hovuzi avtomatik kengayadi — bu funksiyaga tegmaslik kerak.
 */
export async function dealActionCards(opts: {
  tx: Tx;
  gameId: string;
  playerIds: string[];
  isAdult: boolean;
}): Promise<void> {
  const { tx, gameId, playerIds, isAdult } = opts;

  if (playerIds.length === 0) return;

  const pool = await tx.bunkerActionCard.findMany({
    where: {
      enabled: true,
      ...(isAdult ? {} : { isAdult: false })
    },
    select: { id: true, key: true }
  });

  if (pool.length === 0) {
    // Hech qaysi karta enabled emas — sokin chiqamiz, audit log emas, exception emas.
    return;
  }

  // Har bir o'yinchi uchun N ta karta — shuffle bilan tortamiz.
  // Tortishuv: tarqatish "deck" emas, balki "with replacement across players":
  // 5 ta o'yinchili xonada 6 ta enabled karta bilan, har biriga 1 dan tarqalishi muammosiz;
  // pool kichik bo'lganda ham bitta karta bir nechta o'yinchiga tushishi mumkin.
  const rows: Prisma.BunkerActionCardInstanceCreateManyInput[] = [];
  for (const playerId of playerIds) {
    const picks = pickRandom(pool, ACTION_CARDS_PER_PLAYER);
    for (const card of picks) {
      rows.push({
        gameId,
        playerId,
        actionCardId: card.id,
        status: "HELD"
      });
    }
  }

  await tx.bunkerActionCardInstance.createMany({ data: rows });
}

function pickRandom<T>(arr: readonly T[], n: number): T[] {
  if (n >= arr.length) return [...arr];
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

export type PlayActionCardInput = {
  roomCode: string;
  sessionId: string;
  instanceId: string;
  targetPlayerId?: string | null;
};

export type PlayActionCardResult = {
  effect: string;
  resultMeta: Prisma.JsonValue;
  // Karta ishlatuvchisi (boshqalar uchun toast'ga).
  sourcePlayerId: string;
  sourcePlayerName: string;
  // Karta nomi (uz/ru/en) — barcha o'yinchilar ko'radigan toastda ishlatamiz.
  cardKey: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  // Karta tavsifi (uz/ru/en) — toastda nima ish qilishini ko'rsatish uchun.
  descriptionUz: string;
  descriptionRu: string;
  descriptionEn: string;
  // Maqsadli o'yinchi (SELF effektlarda null).
  targetPlayerId: string | null;
};

/**
 * Maxsus karta ishlatish orchestrator'i.
 *
 * Yengil yondashuv: fazani o'zgartirmaymiz, taymerga tegmaymiz.
 * Faqat:
 *   1. Validatsiya (tirik o'yinchi, actionCardsEnabled, hozirgi faza karta ruxsat beradi)
 *   2. Effekt reducer (Faza 3 NO-OP; Faza 4-6 real)
 *   3. Audit ma'lumotini qaytarish — caller broadcast qiladi.
 *
 * Asosiy o'yin (intro, reveal, voting) o'z holida davom etadi; faqat
 * o'yinchilarga toast ko'rsatamiz "X ishlatti Y kartani".
 */
export async function playActionCard(input: PlayActionCardInput): Promise<PlayActionCardResult> {
  return withRoomActionLock(input.roomCode, async () => {
    return prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { code: input.roomCode.toUpperCase() },
        include: {
          bunkerGame: true,
          players: { where: { sessionId: input.sessionId } }
        }
      });
      if (!room) throw new Error("Xona topilmadi.");
      if (!room.bunkerGame) throw new Error("Bunker o'yini boshlanmagan.");
      if (!room.actionCardsEnabled) throw new Error("Maxsus kartalar yoqilmagan.");

      const me = room.players[0];
      if (!me) throw new Error("Siz xonada emassiz.");
      if (!me.isAlive) throw new Error("O'yindan chiqib ketgansiz.");

      if (
        room.bunkerGame.phase === BunkerPhase.LOBBY ||
        room.bunkerGame.phase === BunkerPhase.FINISHED
      ) {
        throw new Error("Hozir maxsus karta ishlatib bo'lmaydi.");
      }

      const effectResult = await applyActionEffect({
        tx,
        gameId: room.bunkerGame.id,
        instanceId: input.instanceId,
        sourcePlayerId: me.id,
        targetPlayerId: input.targetPlayerId ?? null
      });

      // Karta ma'lumotlarini olamiz — caller broadcast/toast uchun.
      const instance = await tx.bunkerActionCardInstance.findUnique({
        where: { id: input.instanceId },
        include: { actionCard: true }
      });
      if (!instance) throw new Error("Karta nusxasi yo'qoldi.");

      return {
        effect: effectResult.effect,
        resultMeta: effectResult.resultMeta as Prisma.JsonValue,
        sourcePlayerId: me.id,
        sourcePlayerName: me.name,
        cardKey: instance.actionCard.key,
        titleUz: instance.actionCard.titleUz,
        titleRu: instance.actionCard.titleRu,
        titleEn: instance.actionCard.titleEn,
        descriptionUz: instance.actionCard.descriptionUz,
        descriptionRu: instance.actionCard.descriptionRu,
        descriptionEn: instance.actionCard.descriptionEn,
        targetPlayerId: input.targetPlayerId ?? null
      };
    });
  });
}
