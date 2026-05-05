import { BunkerCardType, BunkerDifficulty, PrismaClient } from "@prisma/client";

import { seedContent, type SeedContent } from "./seed-content";

const prisma = new PrismaClient();

const cardTypeMap: Record<string, BunkerCardType> = {
  kasb: BunkerCardType.PROFESSION,
  soglik: BunkerCardType.HEALTH,
  xarakter: BunkerCardType.CHARACTER,
  skill: BunkerCardType.SKILL,
  bagaj: BunkerCardType.BAGGAGE,
  fakt: BunkerCardType.FACT
};

function loadSeedContent(): SeedContent {
  return seedContent;
}

async function main() {
  const content = loadSeedContent();
  const cards = Object.entries(content.cards).flatMap(([key, values]) => {
    const type = cardTypeMap[key];

    if (!type) {
      return [];
    }

    return values.map((item) => ({
      type,
      text: item.uz,
      textRu: item.ru,
      textEn: item.en,
      isAdult: item.isAdult ?? false
    }));
  });

  // Idempotent bootstrap:
  //   - canonical Uzbek fields remain the source of truth
  //   - ru/en fields are backfilled without clobbering manual uz edits
  // Set SEED_RESET=1 to force a clean re-seed from the bundled seed content.
  const force = process.env.SEED_RESET === "1";

  const [cardCount, disasterCount, situationCount] = await Promise.all([
    prisma.bunkerCard.count(),
    prisma.bunkerDisaster.count(),
    prisma.bunkerSituation.count()
  ]);

  if (force) {
    await prisma.bunkerCard.deleteMany();
    await prisma.bunkerDisaster.deleteMany();
    await prisma.bunkerSituation.deleteMany();
  }

  if (force || cardCount === 0) {
    await prisma.bunkerCard.createMany({ data: cards, skipDuplicates: true });
  } else {
    for (const card of cards) {
      await prisma.bunkerCard.upsert({
        where: {
          type_text: {
            type: card.type,
            text: card.text
          }
        },
        update: {
          textRu: card.textRu,
          textEn: card.textEn
        },
        create: card
      });
    }
  }

  const disasters = content.disasters.map((item) => ({
    name: item.name.uz,
    nameRu: item.name.ru,
    nameEn: item.name.en,
    description: item.description.uz,
    descriptionRu: item.description.ru,
    descriptionEn: item.description.en,
    isAdult: item.isAdult ?? false
  }));

  if (force || disasterCount === 0) {
    await prisma.bunkerDisaster.createMany({
      data: disasters,
      skipDuplicates: true
    });
  } else {
    for (const disaster of disasters) {
      await prisma.bunkerDisaster.upsert({
        where: { name: disaster.name },
        update: {
          nameRu: disaster.nameRu,
          nameEn: disaster.nameEn,
          descriptionRu: disaster.descriptionRu,
          descriptionEn: disaster.descriptionEn
        },
        create: disaster
      });
    }
  }

  const situations = content.situations.map((situation) => ({
    text: situation.text.uz,
    textRu: situation.text.ru,
    textEn: situation.text.en,
    difficulty: situation.difficulty ?? BunkerDifficulty.MEDIUM,
    isAdult: situation.isAdult ?? false
  }));

  if (force || situationCount === 0) {
    await prisma.bunkerSituation.createMany({
      data: situations,
      skipDuplicates: true
    });
  } else {
    for (const situation of situations) {
      await prisma.bunkerSituation.upsert({
        where: { text: situation.text },
        update: {
          textRu: situation.textRu,
          textEn: situation.textEn
        },
        create: situation
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
