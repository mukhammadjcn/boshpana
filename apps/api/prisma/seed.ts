import { CardType, Difficulty, PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();

const cardTypeMap: Record<string, CardType> = {
  kasb: CardType.PROFESSION,
  soglik: CardType.HEALTH,
  xarakter: CardType.CHARACTER,
  skill: CardType.SKILL,
  bagaj: CardType.BAGGAGE,
  fakt: CardType.FACT
};

type SeedContent = {
  cards: Record<string, string[]>;
  disasters: Array<{ name: string; description: string }>;
  situations: Array<{ text: string; difficulty?: Difficulty }>;
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
    | { situations: Array<{ text: string; difficulty?: Difficulty }> }
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

  await prisma.card.deleteMany();
  await prisma.disaster.deleteMany();
  await prisma.situation.deleteMany();

  await prisma.card.createMany({
    data: cards
  });

  await prisma.disaster.createMany({
    data: content.disasters
  });

  await prisma.situation.createMany({
    data: content.situations.map((situation) => ({
      text: situation.text,
      difficulty: situation.difficulty ?? Difficulty.MEDIUM
    }))
  });
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
