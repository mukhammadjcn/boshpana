import { BunkerCardType, BunkerDifficulty, PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();

const cardTypeMap: Record<string, BunkerCardType> = {
  kasb: BunkerCardType.PROFESSION,
  soglik: BunkerCardType.HEALTH,
  xarakter: BunkerCardType.CHARACTER,
  skill: BunkerCardType.SKILL,
  bagaj: BunkerCardType.BAGGAGE,
  fakt: BunkerCardType.FACT
};

type SeedContent = {
  cards: Record<string, string[]>;
  disasters: Array<{ name: string; description: string }>;
  situations: Array<{ text: string; difficulty?: BunkerDifficulty }>;
};

function loadSeedContent(): SeedContent {
  const candidates = [
    resolve(process.cwd(), "../../data.md"),
    resolve(process.cwd(), "data.md")
  ];

  const filePath = candidates.find((candidate) => existsSync(candidate));

  if (!filePath) {
    throw new Error("data.md topilmadi. Seed uchun loyiha root'idagi fayl kerak.");
  }

  const raw = readFileSync(filePath, "utf8");
  const blocks = raw
    .split(/\n\s*\n(?=\{)/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => JSON.parse(block) as Record<string, unknown>);

  const cardBlock = blocks.find((block) => "cards" in block) as
    | { cards: Record<string, string[]> }
    | undefined;
  const disasterBlock = blocks.find((block) => "disasters" in block) as
    | { disasters: Array<{ name: string; description: string }> }
    | undefined;
  const situationBlock = blocks.find((block) => "situations" in block) as
    | { situations: Array<{ text: string; difficulty?: BunkerDifficulty }> }
    | undefined;

  if (!cardBlock || !disasterBlock || !situationBlock) {
    throw new Error("data.md ichidagi cards, disasters va situations bloklari topilmadi.");
  }

  return {
    cards: cardBlock.cards,
    disasters: disasterBlock.disasters,
    situations: situationBlock.situations
  };
}

async function main() {
  const content = loadSeedContent();
  const cards = Object.entries(content.cards).flatMap(([key, values]) => {
    const type = cardTypeMap[key];

    if (!type) {
      return [];
    }

    return values.map((text) => ({
      type,
      text
    }));
  });

  // Idempotent bootstrap: only seed tables that are currently empty so
  // manual DB edits (e.g. card text tweaks) survive container restarts.
  // Set SEED_RESET=1 to force a clean re-seed from data.md.
  const force = process.env.SEED_RESET === "1";

  const [cardCount, disasterCount, situationCount] = await Promise.all([
    prisma.bunkerCard.count(),
    prisma.bunkerDisaster.count(),
    prisma.bunkerSituation.count()
  ]);

  if (force || cardCount === 0) {
    if (force) await prisma.bunkerCard.deleteMany();
    await prisma.bunkerCard.createMany({ data: cards, skipDuplicates: true });
  }

  if (force || disasterCount === 0) {
    if (force) await prisma.bunkerDisaster.deleteMany();
    await prisma.bunkerDisaster.createMany({
      data: content.disasters,
      skipDuplicates: true
    });
  }

  if (force || situationCount === 0) {
    if (force) await prisma.bunkerSituation.deleteMany();
    await prisma.bunkerSituation.createMany({
      data: content.situations.map((situation) => ({
        text: situation.text,
        difficulty: situation.difficulty ?? BunkerDifficulty.MEDIUM
      })),
      skipDuplicates: true
    });
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
