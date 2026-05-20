import type { Prisma, PrismaClient } from "@prisma/client";

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
