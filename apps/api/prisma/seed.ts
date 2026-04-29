import { CardType, Difficulty, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const cards: Array<{ type: CardType; text: string }> = [
  { type: CardType.PROFESSION, text: "Shifokor" },
  { type: CardType.PROFESSION, text: "Muhandis" },
  { type: CardType.HEALTH, text: "Sog'lom" },
  { type: CardType.HEALTH, text: "Astma bilan yashaydi" },
  { type: CardType.CHARACTER, text: "Bosiq va vazmin" },
  { type: CardType.CHARACTER, text: "Juda tez asabiylashadi" },
  { type: CardType.SKILL, text: "Birinchi yordamni mukammal biladi" },
  { type: CardType.SKILL, text: "Elektr tizimlarini tuzata oladi" },
  { type: CardType.BAGGAGE, text: "Ko'p funksiyali pichoq" },
  { type: CardType.BAGGAGE, text: "Quyosh batareyali fonar" },
  { type: CardType.FACT, text: "Bir yil tog'da yolg'iz yashagan" },
  { type: CardType.FACT, text: "Oziq-ovqat allergiyasi bor" }
];

const disasters = [
  {
    name: "Global sovuq to'lqin",
    description: "Yer yuzida harorat keskin tushib ketdi, tashqarida uzoq yashab bo'lmaydi."
  },
  {
    name: "Kimyoviy avariya",
    description: "Havoga zaharli modda tarqalgan, bunker ichidagi resurslar cheklangan."
  }
];

const situations = [
  {
    text: "Bunker ichidagi ichimlik suvi zahirasi kutilganidan ancha kam ekan.",
    difficulty: Difficulty.MEDIUM
  },
  {
    text: "Elektr generatori ishlamay qoldi, kim uni tezda tiklay olishini isbotlashi kerak.",
    difficulty: Difficulty.HARD
  },
  {
    text: "Bunker eshigi tashqaridan nimadir urayotgan ovozlar bilan titray boshladi.",
    difficulty: Difficulty.EASY
  }
];

async function main() {
  for (const card of cards) {
    await prisma.card.upsert({
      where: { type_text: { type: card.type, text: card.text } },
      create: card,
      update: {}
    });
  }

  for (const disaster of disasters) {
    await prisma.disaster.upsert({
      where: { name: disaster.name },
      create: disaster,
      update: { description: disaster.description }
    });
  }

  for (const situation of situations) {
    await prisma.situation.upsert({
      where: { text: situation.text },
      create: situation,
      update: { difficulty: situation.difficulty }
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
