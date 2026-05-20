import { BunkerDifficulty } from "@prisma/client";

export type SeedLocalizedText = {
  uz: string;
  ru: string;
  en: string;
};

// ============================================================
// TAG KATEGORIYALARI — barcha tag'lar shu kategoriyalar ichida bo'lishi kerak.
// Yangi tag qo'shsangiz, kerakli kategoriyaga qo'shing.
// UI rang/icon ko'rsatishda ham shu kategoriyalardan foydalanish mumkin.
// ============================================================
export const TAG_CATEGORIES = {
  // Tashqi muhitda omon qolish ko'nikmalari
  survival: [
    "ovchilik",
    "suv-topish",
    "omon-qolish",
    "o't-yoqish",
    "navigatsiya",
    "dehqonchilik-ichki",
    "ferma",
    "dehqon",
    "eski-uslublar",
    "muqobil-saqlash",
    "kuzatuv",
    "tashqari-ish-yo'q",
    "signal-yashirish",
    "tungi-ish",
  ],

  // Texnik bilim va ta'mirlash
  technical: [
    "muhandislik",
    "elektrik",
    "ta'mirlash",
    "texnika",
    "kimyo",
    "quruvchi",
    "radiatsiya-bilim",
  ],

  // Tibbiyot va shifo
  medical: ["tibbiyot", "shifo", "dori", "karantin-bilim"],

  // Jang va qurol
  combat: ["qurol", "jang"],

  // Jismoniy ijobiy holat
  physical_positive: [
    "jismoniy-kuch",
    "chidamlilik",
    "tez-yugurish",
    "tezda-harakat",
    "sog'lom",
    "immunitet-kuchli",
    "issiqqa-chidamli",
    "sovuqqa-chidamli",
    "yosh",
  ],

  // Aqliy va liderlik (ijobiy)
  mental_positive: [
    "aql",
    "lider",
    "sovuqqonlik",
    "intizomli",
    "sabr",
  ],

  // Ijtimoiy ijobiy xarakter
  social_positive: [
    "ishonchli",
    "mehribon",
    "jamoaviy-ish",
    "optimist",
    "hazilkash",
  ],

  // Salbiy xarakter — guruh uchun xavf
  psychological_risk: [
    "manipulyator",
    "hiylakor",
    "egoist",
    "jahldor",
    "sabrsiz",
    "pessimist",
    "qo'rqoq",
    "dangasa",
    "shovqinli",
    "pranker",
    "doim-yolg'on-gapiradi",
  ],

  // Sog'liq muammolari — surunkali yoki vaqtinchalik
  health_burden: [
    "surunkali-kasallik",
    "immunitet-zaif",
    "astma",
    "allergiya",
    "qandli-diabet",
    "diabet",
    "yurak-kasalligi",
    "qon-bosimi-yuqori",
    "doimiy-og'riq",
    "tibbiy-yordamga-muhtoj",
    "keksa",
    "oyoq-jarohati",
    "tez-charchaydi",
    "sovuqqa-chidamsiz",
    "issiqqa-chidamsiz",
    "sekin",
  ],

  // Resurs ko'p sarflaydigan
  resource_burden: ["ko'p-ovqat", "ko'p-suv-ichadi"],

  // Turmush tarzi — kasbga oid xavf yoki foydasizlik
  lifestyle_risk: [
    "bloger",
    "texnologiyaga-bog'liq",
    "signal-chiqaradi",
    "e'tibor-tortadi",
    "foydasiz-ish",
    "dating-ekspert",
  ],

  // Ijtimoiy/qonuniy holat
  status: ["yashirin-boy", "qarzdor", "firibgar", "yashirin-fakt"],

  // Ko'paytirish qobiliyati
  reproduction: ["ko'paytirish-qobiliyati", "ko'paytirish-imkoni-yo'q"],

  // Asbob/buyum (bagaj kartalari uchun)
  gear: ["issiq-kiyim", "ovqat-zaxirasi"],
} as const;

export type TagCategory = keyof typeof TAG_CATEGORIES;

export type SeedContent = {
  cards: Record<
    string,
    Array<SeedLocalizedText & { isAdult?: boolean; tags?: string[] }>
  >;
  disasters: Array<{
    key: string;
    name: SeedLocalizedText;
    description: SeedLocalizedText;
    usefulTags?: string[];
    vulnerableTags?: string[];
    isAdult?: boolean;
  }>;
  situations: Array<{
    text: SeedLocalizedText;
    disasterTags?: string[];
    tier?: number;
    highlightTags?: string[];
    weakTags?: string[];
    voteReason?: SeedLocalizedText;
    difficulty?: BunkerDifficulty;
    isAdult?: boolean;
  }>;
};

function text(uz: string, ru: string, en: string): SeedLocalizedText {
  return { uz, ru, en };
}

// TODO: ru/en tarjima qilinmagan - placeholder
function uz(uzText: string): SeedLocalizedText {
  return { uz: uzText, ru: uzText, en: uzText };
}

// Helper accepts either a plain Uzbek string (ru/en fall back to uz) or
// a tuple [uz, ru, en] for fully translated entries.
type Trio = string | [string, string, string];
function toTrio(v: Trio): SeedLocalizedText {
  if (typeof v === "string") return uz(v);
  return { uz: v[0], ru: v[1], en: v[2] };
}

function sit(opts: {
  text: Trio;
  disasters: string[];
  tier: number;
  highlight: string[];
  weak: string[];
  reason: Trio;
  difficulty?: BunkerDifficulty;
  isAdult?: boolean;
}): SeedContent["situations"][number] {
  return {
    text: toTrio(opts.text),
    disasterTags: opts.disasters,
    tier: opts.tier,
    highlightTags: opts.highlight,
    weakTags: opts.weak,
    voteReason: toTrio(opts.reason),
    difficulty: opts.difficulty,
    isAdult: opts.isAdult,
  };
}

function card(
  uz: string,
  ru: string,
  en: string,
  tags: string[] = [],
): SeedLocalizedText & { tags: string[] } {
  return { uz, ru, en, tags };
}

function cardA(
  uz: string,
  ru: string,
  en: string,
  tags: string[] = [],
): SeedLocalizedText & { tags: string[]; isAdult: true } {
  return { uz, ru, en, tags, isAdult: true };
}

export const seedContent: SeedContent = {
  cards: {
    kasb: [
      card("Elektrik", "Электрик", "Electrician", [
        "elektrik",
        "muhandislik",
        "ta'mirlash",
      ]),
      card("Shifokor", "Врач", "Doctor", [
        "tibbiyot",
        "shifo",
        "karantin-bilim",
      ]),
      card("Dehqon", "Фермер", "Farmer", [
        "dehqon",
        "ferma",
        "dehqonchilik-ichki",
        "eski-uslublar",
        "chidamlilik",
      ]),
      card("Mexanik", "Механик", "Mechanic", [
        "muhandislik",
        "texnika",
        "ta'mirlash",
      ]),
      card("Oshpaz", "Повар", "Cook", ["muqobil-saqlash", "intizomli"]),
      card("Harbiy", "Военный", "Military", ["qurol", "jang", "omon-qolish", "kuzatuv", "sovuqqonlik", "intizomli", "signal-yashirish"]),
      card("Quruvchi", "Строитель", "Builder", [
        "quruvchi",
        "muhandislik",
        "ta'mirlash",
        "jismoniy-kuch",
        "chidamlilik",
      ]),
      card("Haydovchi", "Водитель", "Driver", [
        "navigatsiya",
        "tezda-harakat",
        "chidamlilik",
      ]),
      card("O'qituvchi", "Учитель", "Teacher", [
        "aql",
        "lider",
        "jamoaviy-ish",
        "mehribon",
        "sabr",
      ]),
      card("Sotuvchi", "Продавец", "Salesperson", ["lider", "manipulyator"]),
      card("Bloger", "Блогер", "Blogger", ["bloger", "foydasiz-ish", "texnologiyaga-bog'liq", "signal-chiqaradi", "e'tibor-tortadi", "yosh"]),
      card("Huquqshunos", "Юрист", "Lawyer", ["aql", "manipulyator", "lider"]),
      card("Sportchi", "Спортсмен", "Athlete", ["jismoniy-kuch", "tez-yugurish", "chidamlilik", "sog'lom", "yosh", "ko'p-ovqat", "ko'p-suv-ichadi"]),
      card("Ferma ishchisi", "Работник фермы", "Farm worker", [
        "ferma",
        "dehqonchilik-ichki",
        "jismoniy-kuch",
        "chidamlilik",
      ]),
      card("Sartarosh", "Парикмахер", "Barber", ["foydasiz-ish", "mehribon"]),
      card("Kimyogar", "Химик", "Chemist", ["kimyo", "muhandislik", "tibbiyot", "radiatsiya-bilim"]),

      // 18+
      cardA("Foxisha", "С*кс-работник", "S*x worker", [
        "foydasiz-ish",
        "ko'paytirish-qobiliyati",
      ]),
      cardA("Pornofilm rejissyori", "Режиссёр порно", "Porn director", [
        "foydasiz-ish",
        "bloger",
      ]),
      cardA("Striptiz raqschi", "Стриптизёр", "Stripper", ["jismoniy-kuch", "foydasiz-ish", "yosh"]),
      cardA("Kazino dilleri", "Казино-дилер", "Casino dealer", [
        "foydasiz-ish",
        "manipulyator",
      ]),
      cardA(
        "Qonuniy giyohvand sotuvchi",
        "Легальный наркодилер",
        "Legal drug dealer",
        ["kimyo", "manipulyator"],
      ),
      cardA("Qurol savdogari", "Торговец оружием", "Arms dealer", [
        "qurol",
        "jang",
      ]),
      cardA("Kriptovalyuta sxemachisi", "Крипто-мошенник", "Crypto scammer", [
        "foydasiz-ish",
        "firibgar",
        "texnologiyaga-bog'liq",
      ]),
      cardA("Jasadlarni yuvuvchi", "Обмыватель трупов", "Body washer", [
        "tibbiyot",
        "sovuqqonlik",
      ]),
      cardA("OnlyFans modeli", "Модель OnlyFans", "OnlyFans model", ["foydasiz-ish", "bloger", "texnologiyaga-bog'liq", "yosh"]),
      cardA(
        "Tungi klub xodimi",
        "Работник ночного клуба",
        "Night club worker",
        ["tungi-ish", "foydasiz-ish"],
      ),
      cardA("Strip dancer", "Стрип-танцор", "Strip dancer", [
        "jismoniy-kuch",
        "foydasiz-ish",
      ]),
      cardA("Soxta psixolog", "Фейковый психолог", "Fake psychologist", [
        "foydasiz-ish",
        "manipulyator",
        "firibgar",
      ]),
      cardA("Pranker", "Пранкер", "Prankster", ["pranker", "foydasiz-ish", "shovqinli", "yosh"]),
    ],
    soglik: [
      card("To'liq sog'lom", "Полностью здоров", "Perfectly healthy", [
        "sog'lom",
        "immunitet-kuchli",
      ]),
      card("Yurak muammosi", "Проблемы с сердцем", "Heart condition", ["yurak-kasalligi", "surunkali-kasallik", "tibbiy-yordamga-muhtoj", "immunitet-zaif"]),
      card("Astma", "Астма", "Asthma", ["astma", "surunkali-kasallik", "tibbiy-yordamga-muhtoj", "immunitet-zaif"]),
      card("Allergiya", "Аллергия", "Allergy", ["allergiya", "tibbiy-yordamga-muhtoj", "immunitet-zaif"]),
      card("Qandli diabet", "Сахарный диабет", "Diabetes", ["qandli-diabet", "diabet", "surunkali-kasallik", "tibbiy-yordamga-muhtoj", "immunitet-zaif"]),
      card("Juda chidamli", "Очень вынослив", "Very resilient", [
        "chidamlilik",
        "jismoniy-kuch",
        "sog'lom",
        "issiqqa-chidamli",
        "sovuqqa-chidamli",
        "immunitet-kuchli",
      ]),
      card("Tez charchaydi", "Быстро устает", "Tires quickly", [
        "tez-charchaydi",
        "sekin",
      ]),
      card("Ko'rish past", "Плохое зрение", "Poor eyesight", [
        "sekin",
        "tez-charchaydi",
      ]),
      card("Eshitish muammo", "Проблемы со слухом", "Hearing problems", [
        "sekin",
      ]),
      card("Immunitet kuchli", "Сильный иммунитет", "Strong immunity", [
        "immunitet-kuchli",
        "sog'lom",
        "chidamlilik",
      ]),
      card("Doimiy og'riq", "Хроническая боль", "Chronic pain", ["doimiy-og'riq", "surunkali-kasallik", "tibbiy-yordamga-muhtoj", "sekin", "immunitet-zaif"]),
      card("Tez sog'ayadi", "Быстро восстанавливается", "Heals quickly", [
        "sog'lom",
        "immunitet-kuchli",
        "chidamlilik",
      ]),
      card("Qon bosimi yuqori", "Высокое давление", "High blood pressure", ["qon-bosimi-yuqori", "surunkali-kasallik", "issiqqa-chidamsiz", "immunitet-zaif"]),
      card("Sovuqqa chidamsiz", "Плохо переносит холод", "Sensitive to cold", [
        "sovuqqa-chidamsiz",
        "tez-charchaydi",
      ]),
      card("Issiqqa chidamsiz", "Плохо переносит жару", "Sensitive to heat", [
        "issiqqa-chidamsiz",
        "tez-charchaydi",
      ]),
      card("Oyoq jarohati", "Травма ноги", "Leg injury", [
        "oyoq-jarohati",
        "sekin",
        "tez-charchaydi",
      ]),
      card("Sport jarohati", "Спортивная травма", "Sports injury", [
        "sekin",
        "oyoq-jarohati",
      ]),
      card("Juda baquvvat", "Очень крепкий", "Very strong", ["jismoniy-kuch", "chidamlilik", "sog'lom", "sovuqqa-chidamli", "ko'p-ovqat", "ko'p-suv-ichadi"]),

      // Alohida tibbiy/jismoniy holatlar
      card("Sun'iy yurakli", "С искусственным сердцем", "Artificial heart", [
        "surunkali-kasallik",
        "tibbiy-yordamga-muhtoj",
        "chidamlilik",
        "yurak-kasalligi",
      ]),
      card("Genetik mutant", "Генетический мутант", "Genetic mutant", [
        "immunitet-kuchli",
        "sog'lom",
        "radiatsiya-bilim",
        "yashirin-fakt",
      ]),
      card("Ikki yurakli (anomaliya)", "С двумя сердцами (аномалия)", "Two hearts (anomaly)", [
        "chidamlilik",
        "sog'lom",
        "immunitet-kuchli",
        "yashirin-fakt",
      ]),
      card("Vampir tabiatli", "С вампирской натурой", "Vampire-natured", [
        "tungi-ish",
        "issiqqa-chidamsiz",
        "immunitet-kuchli",
        "tashqari-ish-yo'q",
      ]),
      card("Kor (ko'rmaydi)", "Слепой", "Blind", [
        "sekin",
        "tez-charchaydi",
        "aql",
        "tibbiy-yordamga-muhtoj",
      ]),
      card("Kar-soqov", "Глухонемой", "Deaf-mute", [
        "sekin",
        "signal-yashirish",
        "intizomli",
      ]),

      // 18+
      cardA("Libido juda yuqori", "Очень высокое либидо", "Very high libido", [
        "ko'paytirish-qobiliyati",
      ]),
      cardA("Tez qo'zg'aladi", "Легко возбуждается", "Gets aroused easily", [
        "ko'paytirish-qobiliyati",
      ]),
      cardA("Oshqozoni yo'q", "Нет желудка", "No stomach", ["surunkali-kasallik", "tibbiy-yordamga-muhtoj", "immunitet-zaif"]),
    ],
    biologiya: [
      // Jins va asosiy biologik holatlar
      card("Erkak, 30 yosh", "Мужчина, 30 лет", "Male, 30 y/o", [
        "jismoniy-kuch",
        "ko'paytirish-qobiliyati",
      ]),
      card("Ayol, 28 yosh", "Женщина, 28 лет", "Female, 28 y/o", [
        "ko'paytirish-qobiliyati",
      ]),
      card("Erkak, 45 yosh", "Мужчина, 45 лет", "Male, 45 y/o", [
        "ko'paytirish-qobiliyati",
      ]),
      card("Ayol, 40 yosh", "Женщина, 40 лет", "Female, 40 y/o", [
        "ko'paytirish-qobiliyati",
      ]),
      card("Semiz erkak (110 kg)", "Полный мужчина (110 кг)", "Overweight man (110 kg)", [
        "sekin",
        "tez-charchaydi",
        "ko'p-ovqat",
        "ko'p-suv-ichadi",
      ]),
      card("Ozg'in ayol (45 kg)", "Худая женщина (45 кг)", "Thin woman (45 kg)", [
        "sekin",
        "tez-charchaydi",
        "immunitet-zaif",
      ]),
      card("Past bo'yli (155 sm)", "Низкий рост (155 см)", "Short (155 cm)", [
        "tezda-harakat",
      ]),
      card("Baland bo'yli (195 sm)", "Высокий рост (195 см)", "Tall (195 cm)", [
        "jismoniy-kuch",
        "ko'p-ovqat",
      ]),
      card("Mitti (130 sm)", "Карлик (130 см)", "Dwarf (130 cm)", [
        "tezda-harakat",
        "sekin",
        "oyoq-jarohati",
      ]),

      // Bolalar va o'smirlar
      card("6 yoshli bolakay", "6-летний мальчик", "6-year-old boy", [
        "yosh",
        "sekin",
        "tez-charchaydi",
        "ko'paytirish-imkoni-yo'q",
        "tibbiy-yordamga-muhtoj",
        "immunitet-zaif",
      ]),
      card("9 yoshli yetim", "9-летний сирота", "9-year-old orphan", [
        "yosh",
        "chidamlilik",
        "omon-qolish",
        "ko'paytirish-imkoni-yo'q",
      ]),
      card("12 yoshli o'smir", "12-летний подросток", "12-year-old preteen", [
        "yosh",
        "sabrsiz",
        "tez-charchaydi",
        "shovqinli",
      ]),
      card("15 yoshli o'smir qiz", "15-летняя девочка-подросток", "15-year-old teenage girl", [
        "yosh",
        "ko'paytirish-qobiliyati",
        "sabrsiz",
        "mehribon",
      ]),
      card("17 yoshli yigit", "17-летний парень", "17-year-old young man", [
        "yosh",
        "jismoniy-kuch",
        "ko'paytirish-qobiliyati",
        "chidamlilik",
      ]),
      card("Egizak 7 yashar bolalar", "Близнецы 7 лет", "Twins, age 7", [
        "yosh",
        "sekin",
        "ko'p-ovqat",
        "ko'p-suv-ichadi",
        "ko'paytirish-imkoni-yo'q",
      ]),
      card("Homilador (8 oylik)", "Беременная (8 месяцев)", "Pregnant (8 months)", [
        "ko'paytirish-qobiliyati",
        "sekin",
        "tez-charchaydi",
        "tibbiy-yordamga-muhtoj",
        "ko'p-ovqat",
      ]),

      // Keksalar
      card("65 yoshli pensioner", "65-летний пенсионер", "65-year-old retiree", [
        "keksa",
        "sekin",
        "aql",
        "sabr",
        "intizomli",
      ]),
      card("75 yoshli buva", "75-летний дед", "75-year-old grandfather", [
        "keksa",
        "sekin",
        "tez-charchaydi",
        "aql",
        "eski-uslublar",
      ]),
      card("85 yoshli bobo", "85-летний старик", "85-year-old old man", [
        "keksa",
        "sekin",
        "tez-charchaydi",
        "immunitet-zaif",
        "ko'paytirish-imkoni-yo'q",
        "doimiy-og'riq",
      ]),
      card("90 yoshli onaxon", "90-летняя бабушка", "90-year-old grandmother", [
        "keksa",
        "sekin",
        "tez-charchaydi",
        "immunitet-zaif",
        "ko'paytirish-imkoni-yo'q",
        "surunkali-kasallik",
        "tibbiy-yordamga-muhtoj",
      ]),
      card("100 yoshli oqsoqol", "100-летний старец", "100-year-old elder", [
        "keksa",
        "aql",
        "lider",
        "sekin",
        "tibbiy-yordamga-muhtoj",
        "eski-uslublar",
      ]),
    ],
    skill: [
      card("Ov qilishni biladi", "Умеет охотиться", "Knows how to hunt", [
        "ovchilik",
        "qurol",
        "omon-qolish",
        "kuzatuv",
      ]),
      card(
        "Suv topishni biladi",
        "Умеет находить воду",
        "Knows how to find water",
        ["suv-topish", "omon-qolish"],
      ),
      card("Ta'mirlashni biladi", "Умеет чинить", "Can repair things", [
        "ta'mirlash",
        "muhandislik",
        "texnika",
      ]),
      card("Ovqat pishirishni biladi", "Умеет готовить", "Can cook", [
        "muqobil-saqlash",
        "intizomli",
      ]),
      card("Elektr tuzatadi", "Чинит электрику", "Fixes electrical systems", [
        "elektrik",
        "muhandislik",
        "ta'mirlash",
        "texnika",
      ]),
      card(
        "Tibbiy yordam ko'rsatadi",
        "Оказывает первую помощь",
        "Gives medical aid",
        ["tibbiyot", "shifo", "karantin-bilim"],
      ),
      card("O't yoqishni biladi", "Умеет разводить огонь", "Can start a fire", [
        "o't-yoqish",
        "omon-qolish",
        "eski-uslublar",
      ]),
      card(
        "Bog'dorchilik qila oladi",
        "Умеет заниматься садоводством",
        "Can garden",
        ["dehqonchilik-ichki", "ferma", "dehqon", "sabr"],
      ),
      card(
        "Navigatsiyani biladi",
        "Разбирается в навигации",
        "Knows navigation",
        ["navigatsiya", "kuzatuv", "aql"],
      ),
      card(
        "Himoyalanishni biladi",
        "Умеет защищаться",
        "Can defend themselves",
        ["jang", "qurol", "jismoniy-kuch"],
      ),
      card("Reja tuzadi", "Умеет строить планы", "Plans strategically", [
        "aql",
        "lider",
        "sabr",
      ]),
      card(
        "Tez qaror qiladi",
        "Быстро принимает решения",
        "Makes quick decisions",
        ["sovuqqonlik", "tezda-harakat", "aql"],
      ),
      card("Resurs topadi", "Находит ресурсы", "Finds resources", [
        "omon-qolish",
        "kuzatuv",
        "aql",
      ]),
      card("Savdo qila oladi", "Умеет торговаться", "Can negotiate trades", [
        "lider",
        "manipulyator",
        "aql",
      ]),
      card("Omon qolishni biladi", "Знает, как выживать", "Knows survival", [
        "omon-qolish",
        "chidamlilik",
        "eski-uslublar",
        "tashqari-ish-yo'q",
      ]),
      card("Qidiruv qila oladi", "Умеет искать", "Good at searching", [
        "kuzatuv",
        "sabr",
      ]),
      card(
        "Muzlatmasdan saqlaydi",
        "Умеет хранить без холодильника",
        "Preserves without refrigeration",
        ["muqobil-saqlash", "kimyo", "eski-uslublar"],
      ),
      card(
        "Odamlarni ishontiradi",
        "Умеет убеждать людей",
        "Persuades people",
        ["lider", "manipulyator", "aql"],
      ),
      // 18+
      cardA(
        "Odamlarni manipulyatsiya qila oladi",
        "Умеет манипулировать людьми",
        "Can manipulate people",
        ["manipulyator", "hiylakor"],
      ),
      cardA(
        "Spirtli ichimlik tayyorlaydi",
        "Умеет гнать самогон",
        "Can brew alcohol",
        ["kimyo"],
      ),
      cardA("Qurol yasaydi", "Умеет делать оружие", "Can make weapons", [
        "qurol",
        "jang",
        "muhandislik",
      ]),
      cardA("Zahar tayyorlaydi", "Умеет готовить яды", "Can prepare poisons", [
        "kimyo",
      ]),
      cardA(
        "Hujjat qalbaki qiladi",
        "Умеет подделывать документы",
        "Can forge documents",
        ["aql", "hiylakor"],
      ),
    ],
    bagaj: [
      card("Dori qutisi", "Аптечка", "First-aid kit", [
        "tibbiyot",
        "shifo",
        "dori",
      ]),
      card("Asboblar to'plami", "Набор инструментов", "Tool kit", [
        "ta'mirlash",
        "muhandislik",
        "texnika",
      ]),
      card("10 kunlik ovqat", "Еда на 10 дней", "10 days of food", [
        "ovqat-zaxirasi",
        "muqobil-saqlash",
      ]),
      card("Suv filtri", "Фильтр для воды", "Water filter", [
        "suv-topish",
        "kimyo",
      ]),
      card("Generator", "Генератор", "Generator", [
        "elektrik",
        "muhandislik",
        "o't-yoqish",
      ]),
      card("Fonar", "Фонарь", "Flashlight", ["tungi-ish"]),
      card("Pichoq", "Нож", "Knife", ["qurol", "ovchilik"]),
      card("Radio", "Радио", "Radio", ["eski-uslublar"]),
      card("Yoqilg'i", "Топливо", "Fuel", ["o't-yoqish", "issiq-kiyim"]),
      card("Arqon", "Веревка", "Rope", ["omon-qolish", "ta'mirlash"]),
      card("Gaz plita", "Газовая плитка", "Gas stove", [
        "o't-yoqish",
        "muqobil-saqlash",
      ]),
      card("Issiq kiyim", "Теплая одежда", "Warm clothing", [
        "issiq-kiyim",
        "sovuqqa-chidamli",
      ]),
      card("Kompas", "Компас", "Compass", ["navigatsiya", "eski-uslublar"]),
      card("Dori o'simliklar", "Лекарственные травы", "Medicinal herbs", [
        "tibbiyot",
        "shifo",
        "dehqonchilik-ichki",
        "eski-uslublar",
      ]),
      card("Laptop (offline)", "Ноутбук (офлайн)", "Laptop (offline)", [
        "aql",
        "texnologiyaga-bog'liq",
      ]),
      card("Chodir", "Палатка", "Tent", [
        "issiq-kiyim",
        "omon-qolish",
        "sovuqqa-chidamli",
      ]),
      card("Kitoblar", "Книги", "Books", ["aql", "eski-uslublar"]),
      // card("Hech narsa", "Ничего", "Nothing", ["foydasiz-ish"]),
      // 18+
      cardA("Prezervativlar", "Презервативы", "Condoms", []),
      cardA("Erkaklar o'yinchog'i", "Мужская игрушка", "Male's toy", [
        "foydasiz-ish",
      ]),
      cardA("Ayollar o'yinchog'i", "Женская игрушка", "Female's toy", [
        "foydasiz-ish",
      ]),
      cardA("Spirtli ichimliklar", "Алкоголь", "Alcohol supply", ["kimyo"]),
      cardA("An*l probka", "Анальная пробка", "Butt plug", ["foydasiz-ish"]),
      cardA("S*ks videolar", "С*кс-видео", "S*x videos", ["foydasiz-ish"]),
      cardA("Eva Elfie o'zi", "Сама Ева Эльфи", "Eva Elfie herself", [
        "foydasiz-ish",
      ]),
      cardA("Kuchli brat", "Крепкий братан", "Big strong dude", ["jismoniy-kuch", "qurol", "ko'p-ovqat"]),
      cardA("Viagra", "Виагра", "Viagra", ["ko'paytirish-qobiliyati"]),
    ],
    fakt: [
      // Xarakter — shaxsiyat xususiyatlari (asl Bunker o'yinida Fakt deckiga kiradi)
      card("Lider", "Лидер", "Leader", [
        "lider",
        "jamoaviy-ish",
        "aql",
        "sovuqqonlik",
      ]),
      card("Manipulyator", "Манипулятор", "Manipulator", [
        "manipulyator",
        "hiylakor",
        "aql",
      ]),
      card("Qo'rqoq", "Трус", "Coward", ["qo'rqoq", "foydasiz-ish"]),
      card("Hazilkash", "Шутник", "Jokester", [
        "hazilkash",
        "optimist",
        "shovqinli",
      ]),
      card("Sovuqqon", "Хладнокровный", "Cold-blooded", [
        "sovuqqonlik",
        "intizomli",
        "sabr",
      ]),
      card("Jahldor", "Вспыльчивый", "Hot-tempered", [
        "jahldor",
        "sabrsiz",
        "shovqinli",
      ]),
      card("Mehribon", "Добрый", "Kind", ["mehribon", "jamoaviy-ish"]),
      card("Egoist", "Эгоист", "Selfish", ["egoist", "manipulyator"]),
      card("Ishonchli", "Надежный", "Reliable", [
        "ishonchli",
        "intizomli",
        "jamoaviy-ish",
      ]),
      card("Dangasa", "Ленивый", "Lazy", ["dangasa", "foydasiz-ish"]),
      card("Intizomli", "Дисциплинированный", "Disciplined", [
        "intizomli",
        "sabr",
        "jamoaviy-ish",
      ]),
      card("Sabrsiz", "Нетерпеливый", "Impatient", [
        "sabrsiz",
        "jahldor",
        "shovqinli",
      ]),
      card("Aqlli", "Умный", "Smart", ["aql", "lider"]),
      card("Hiylakor", "Хитрый", "Cunning", [
        "hiylakor",
        "manipulyator",
        "doim-yolg'on-gapiradi",
      ]),
      card("Optimist", "Оптимист", "Optimist", ["optimist", "jamoaviy-ish"]),
      card("Pessimist", "Пессимист", "Pessimist", ["pessimist", "qo'rqoq"]),
      card("Jamoaviy", "Командный игрок", "Team player", [
        "jamoaviy-ish",
        "ishonchli",
        "mehribon",
      ]),
      card("Risk qiluvchi", "Любитель риска", "Risk-taker", [
        "sovuqqonlik",
        "jang",
        "tezda-harakat",
      ]),

      // Fobiyalar — qo'rquvlar (asl o'yinda Fakt deckiga kiradi)
      card("Klaustrofobiya", "Клаустрофобия", "Claustrophobia", [
        "qo'rqoq",
        "sabrsiz",
      ]),
      card("Qorong'idan qo'rqadi", "Боится темноты", "Afraid of the dark", [
        "qo'rqoq",
      ]),
      card("Qondan qo'rqadi", "Боится крови", "Afraid of blood", [
        "qo'rqoq",
      ]),
      card("Balandlikdan qo'rqadi", "Боится высоты", "Afraid of heights", [
        "qo'rqoq",
      ]),
      card("O'rgimchakdan qo'rqadi", "Боится пауков", "Afraid of spiders", [
        "qo'rqoq",
      ]),
      card("Ilondan qo'rqadi", "Боится змей", "Afraid of snakes", [
        "qo'rqoq",
      ]),
      card("Suvdan qo'rqadi", "Боится воды", "Afraid of water", [
        "qo'rqoq",
      ]),
      card("Olomondan qo'rqadi", "Боится толпы", "Afraid of crowds", [
        "qo'rqoq",
        "jamoaviy-ish",
      ]),
      card("Yolg'izlikdan qo'rqadi", "Боится одиночества", "Afraid of being alone", [
        "qo'rqoq",
        "jamoaviy-ish",
      ]),
      card("Mikrobdan qo'rqadi", "Боится микробов", "Afraid of germs", [
        "qo'rqoq",
        "intizomli",
      ]),
      card("Shifokordan qo'rqadi", "Боится врачей", "Afraid of doctors", [
        "qo'rqoq",
        "tibbiy-yordamga-muhtoj",
      ]),
      card("Itlardan qo'rqadi", "Боится собак", "Afraid of dogs", [
        "qo'rqoq",
      ]),
      card("O'lim qo'rquvi (tanofobiya)", "Танофобия (страх смерти)", "Thanatophobia (fear of death)", [
        "qo'rqoq",
        "pessimist",
      ]),
      cardA("Ayollardan qo'rqadi (gynofobiya)", "Гинофобия (страх женщин)", "Gynophobia (fear of women)", [
        "qo'rqoq",
        "ko'paytirish-imkoni-yo'q",
      ]),
      cardA("Erkaklardan qo'rqadi (androfobiya)", "Андрофобия (страх мужчин)", "Androphobia (fear of men)", [
        "qo'rqoq",
        "ko'paytirish-imkoni-yo'q",
      ]),

      // Original faktlar
      card("Yashirincha boy", "Тайно богат", "Secretly wealthy", [
        "yashirin-boy",
        "yashirin-fakt",
      ]),
      card(
        "2 yil ko'chada yashagan",
        "2 года жил на улице",
        "Lived on the streets for 2 years",
        ["omon-qolish", "chidamlilik", "eski-uslublar", "jismoniy-kuch"],
      ),
      card(
        "Oldin qamoqda bo'lgan",
        "Раньше сидел в тюрьме",
        "Formerly imprisoned",
        ["jismoniy-kuch", "qarzdor", "jang", "omon-qolish"],
      ),
      card("Genius (IQ 150)", "Гений (IQ 150)", "Genius (IQ 150)", [
        "aql",
        "lider",
      ]),
      card("3 ta farzandi bor", "У него трое детей", "Has 3 children", ["ko'paytirish-qobiliyati", "mehribon", "sabr", "yosh"]),
      card("Doim yolg'on gapiradi", "Постоянно лжет", "Always lies", [
        "doim-yolg'on-gapiradi",
        "manipulyator",
      ]),
      card("Sobiq harbiy", "Бывший военный", "Former military", ["qurol", "jang", "omon-qolish", "jismoniy-kuch", "intizomli", "signal-yashirish"]),
      card("Firibgar", "Мошенник", "Con artist", [
        "firibgar",
        "manipulyator",
        "doim-yolg'on-gapiradi",
      ]),
      card("Omadli", "Везучий", "Lucky", ["sog'lom"]),
      card("Qarzdor", "В долгах", "In debt", ["qarzdor"]),
      card("Mashhur bo'lgan", "Был знаменит", "Used to be famous", [
        "bloger",
        "foydasiz-ish",
        "e'tibor-tortadi",
      ]),
      card(
        "Sirli kasalligi bor",
        "У него загадочная болезнь",
        "Has a mysterious illness",
        ["surunkali-kasallik", "tibbiy-yordamga-muhtoj", "yashirin-fakt", "immunitet-zaif"],
      ),
      card("Omadsiz", "Невезучий", "Unlucky", ["foydasiz-ish"]),
      card("Hammani ishontiradi", "Умеет убедить всех", "Can convince anyone", [
        "lider",
        "manipulyator",
        "aql",
      ]),
      card(
        "O'zi haqida yolg'on gapiradi",
        "Лжет о себе",
        "Lies about themselves",
        ["doim-yolg'on-gapiradi", "yashirin-fakt"],
      ),
      card("Yetim bo'lib o'sgan", "Вырос сиротой", "Grew up an orphan", [
        "chidamlilik",
        "omon-qolish",
      ]),
      card("Katta tajribaga ega", "Имеет большой опыт", "Highly experienced", ["aql", "omon-qolish", "lider", "keksa"]),
      card(
        "Oldin yetakchi bo'lgan",
        "Раньше был лидером",
        "Used to be a leader",
        ["lider", "aql", "jamoaviy-ish", "keksa"],
      ),
      // 18+
      cardA("Gey", "Гей", "Gay", []),
      cardA("Lezbi", "Лесбиянка", "Lesbian", []),
      cardA("Bulbulchasi turmaydi", "Птичка не встаёт", "Can't get it up", [
        "ko'paytirish-imkoni-yo'q",
      ]),
      cardA("Bulbulchasi yo'q", "Птички нет", "Has no birdie", [
        "ko'paytirish-imkoni-yo'q",
      ]),
      cardA(
        "Ekstremal rashkchi",
        "Экстремально ревнивый",
        "Extremely jealous",
        ["jahldor", "manipulyator"],
      ),
      cardA("Kuni ustasi", "Мастер куни", "Cunnilingus master", []),
      cardA(
        "Hayvonlarni juda sevadi",
        "Очень любит животных",
        "Loves animals a lot",
        ["mehribon"],
      ),
      cardA(
        "O'pishmay turolmaydi",
        "Не может без поцелуев",
        "Can't go without kissing",
        [],
      ),
      cardA(
        "Pornofilm yulduzi bo'lgan",
        "Снимался в порно",
        "Was a porn star",
        ["foydasiz-ish", "bloger"],
      ),
      cardA("Yashirin homilador", "Тайно беременна", "Secretly pregnant", [
        "yashirin-fakt",
        "ko'paytirish-qobiliyati",
        "tibbiy-yordamga-muhtoj",
      ]),
      cardA(
        "Qonundan qochyapti",
        "Скрывается от закона",
        "Hiding from the law",
        ["yashirin-fakt"],
      ),
      cardA("Jinsini o'zgartirgan", "Сменил пол", "Changed gender", []),
    ],
  },
  disasters: [
    {
      key: "nuclear",
      name: text("Yadro urushi", "Ядерная война", "Nuclear war"),
      description: text(
        "Dunyo global yadro urushi natijasida vayron bo'lgan. Shaharlar kulga aylangan, havoda radiatsiya o'lim darajasida. Bunker yer ostida 50 metr chuqurlikda — devorlari beton, eshigi po'lat, lekin shamollatish filtri kuchsiz. Oziq-ovqat zaxirasi 6 oyga yetadi, suv qayta tozalanadi lekin filtri eskirgan. Tashqarida -10°C, radiatsiya tushishi uchun kamida 2 yil kerak. Generator dizel bilan ishlaydi, yoqilg'i 4 oyga. Hech kim oyiga bir martadan ko'p tashqariga chiqolmaydi.",
        "Мир разрушен глобальной ядерной войной. Города превратились в пепел, уровень радиации в воздухе смертельный. Бункер на глубине 50 метров — бетонные стены, стальная дверь, но фильтр вентиляции слабый. Запасов еды хватит на 6 месяцев, вода фильтруется повторно, но фильтр изношен. Снаружи -10°C, радиация спадёт минимум через 2 года. Генератор работает на дизеле, топлива на 4 месяца. Никто не может выходить наружу чаще одного раза в месяц.",
        "The world has been destroyed by global nuclear war. Cities are reduced to ash, and radiation in the air is lethal. The bunker sits 50 meters underground — concrete walls, a steel door, but a weak ventilation filter. Food reserves last 6 months; water is recycled but the filter is worn out. Outside it is -10°C, and radiation will take at least 2 years to subside. The generator runs on diesel, with fuel for 4 months. No one can go outside more than once a month.",
      ),
      usefulTags: [
        "muhandislik",
        "texnika",
        "ta'mirlash",
        "tibbiyot",
        "radiatsiya-bilim",
        "omon-qolish",
        "qurol",
        "jismoniy-kuch",
      ],
      vulnerableTags: [
        "foydasiz-ish",
        "surunkali-kasallik",
        "immunitet-zaif",
        "keksa",
        "tibbiy-yordamga-muhtoj",
      ],
    },
    {
      key: "virus",
      name: text("Global virus", "Глобальный вирус", "Global virus"),
      description: text(
        "O'ta yuqumli va tez o'ldiruvchi virus dunyoga tarqalgan, aholining 90% halok bo'lgan. Bunker shahar yaqinida — toza, lekin kichik (50 m²). Havo filtri yangi, lekin oziq-ovqat zaxirasi atigi 3 oyga. Tashqarida virus hali tirik, har qanday yangi odam yoki narsa katta xavf. Eng yomoni — kasallik belgilari 2 hafta ko'rinmasligi mumkin. Har bir yo'tal, har bir isitma butun bunker uchun o'lim hukmi bo'lishi mumkin.",
        "Сверхзаразный и быстро убивающий вирус распространился по миру, 90% населения погибло. Бункер у города — чистый, но маленький (50 м²). Воздушный фильтр новый, но запасов еды всего на 3 месяца. Снаружи вирус ещё активен, любой новый человек или предмет — серьёзная угроза. Хуже всего — симптомы могут не проявляться 2 недели. Каждый кашель, каждая температура может стать смертным приговором для всего бункера.",
        "A highly contagious and fast-killing virus has spread across the world, killing 90% of the population. The bunker sits near the city — clean, but small (50 m²). The air filter is new, but food reserves last only 3 months. Outside the virus is still alive — any new person or object is a serious threat. Worst of all, symptoms can stay hidden for 2 weeks. Every cough, every fever could be a death sentence for the entire bunker.",
      ),
      usefulTags: [
        "tibbiyot",
        "shifo",
        "dori",
        "immunitet-kuchli",
        "sog'lom",
        "karantin-bilim",
        "kimyo",
      ],
      vulnerableTags: [
        "surunkali-kasallik",
        "immunitet-zaif",
        "astma",
        "diabet",
        "yurak-kasalligi",
        "keksa",
        "tibbiy-yordamga-muhtoj",
      ],
    },
    {
      key: "ai",
      name: text("AI isyoni", "Восстание ИИ", "AI uprising"),
      description: text(
        "Sun'iy intellekt nazoratdan chiqib, dronlar va robotlar odamlarni ovlamoqda. Bunker eski sovuq urush davridan qolgan — yer osti, hech qanday elektron signal chiqarmaydi. Elektronika minimal: faqat generator va eski radio. Har qanday telefon, GPS, smartwatch xavf — signali topilsa, dronlar 10 daqiqada keladi. Oziq-ovqat 8 oyga yetadi, lekin tashqarida har qanday harakat o'lim. Yashash uchun texnik bilim, lekin texnologiyasiz yashash bilimi kerak.",
        "Искусственный интеллект вышел из-под контроля — дроны и роботы охотятся на людей. Бункер сохранился со времён холодной войны — подземный, не излучает электронных сигналов. Электроники минимум: только генератор и старое радио. Любой телефон, GPS, смарт-часы — угроза: если сигнал засекут, дроны прилетят за 10 минут. Еды хватит на 8 месяцев, но любое движение снаружи — смерть. Чтобы выжить, нужны технические знания, но знания о жизни без технологий важнее.",
        "Artificial intelligence has gone out of control — drones and robots are hunting humans. The bunker dates back to the Cold War — underground, emitting no electronic signal. Electronics are minimal: only a generator and an old radio. Any phone, GPS, or smartwatch is a threat — if a signal is detected, drones arrive within 10 minutes. Food lasts 8 months, but any movement outside means death. Surviving requires technical knowledge, but knowing how to live without technology matters even more.",
      ),
      usefulTags: [
        "muhandislik",
        "texnika",
        "signal-yashirish",
        "eski-uslublar",
        "kuzatuv",
        "aql",
        "sabr",
        "tashqari-ish-yo'q",
      ],
      vulnerableTags: [
        "texnologiyaga-bog'liq",
        "foydasiz-ish",
        "signal-chiqaradi",
        "e'tibor-tortadi",
      ],
    },
    {
      key: "ice",
      name: text("Muz davri", "Ледниковый период", "Ice age"),
      description: text(
        "Yer keskin sovib ketgan, harorat -50°C. Bunker eski toshkon — qalin devorli, lekin issiqlik tizimi zaif. Yoqilg'i (ko'mir + dizel) 5 oyga yetadi, keyin sovuq ichkariga kira boshlaydi. Oziq-ovqat zaxirasi 4 oyga, ov qilish deyarli imkonsiz — tashqarida ham hayvonlar qirilib bitgan. Suv qor eritib olinadi, lekin yoqilg'i sarflanadi. Issiq kiyim, ko'mir va ovqat eng qimmatli resurs.",
        "Земля резко остыла, температура -50°C. Бункер — старое каменное здание с толстыми стенами, но система отопления слабая. Топлива (уголь + дизель) хватит на 5 месяцев, потом холод начнёт проникать внутрь. Запасов еды на 4 месяца, охотиться почти невозможно — снаружи животные тоже вымерли. Воду получают, растапливая снег, но это тратит топливо. Тёплая одежда, уголь и еда — самые ценные ресурсы.",
        "The Earth has frozen rapidly, with temperatures at -50°C. The bunker is an old stone building — thick walls, but a weak heating system. Fuel (coal + diesel) lasts 5 months; after that, the cold seeps inside. Food reserves last 4 months. Hunting is nearly impossible — animals outside have died off too. Water is melted from snow, but it burns fuel. Warm clothing, coal, and food are the most precious resources.",
      ),
      usefulTags: [
        "jismoniy-kuch",
        "chidamlilik",
        "issiq-kiyim",
        "ovchilik",
        "o't-yoqish",
        "omon-qolish",
        "dehqonchilik-ichki",
      ],
      vulnerableTags: [
        "sovuqqa-chidamsiz",
        "keksa",
        "oyoq-jarohati",
        "astma",
        "tez-charchaydi",
        "foydasiz-ish",
      ],
    },
    {
      key: "heat",
      name: text("Issiq apokalipsis", "Жаркий апокалипсис", "Heat apocalypse"),
      description: text(
        "Global isish — Yer 60°C ga qizib ketgan. Bunker yer ostida, lekin sovutish tizimi suv talab qiladi — har 3 kunda ta'mirlanmasa, ichkari ham 50°C bo'ladi. Suv eng katta muammo: bunker quduqi qurib bormoqda, har bir tomchi hisobda. Oziq-ovqat 6 oyga, lekin issiqdan tez buziladi. Tashqariga chiqish kunduzi imkonsiz — terisi pista bo'ladi. Faqat tunda, qisqa vaqt. Suv topadigan, sovutish tizimini ushlaydigan odamlar qahramon.",
        "Глобальное потепление — Земля раскалилась до 60°C. Бункер под землёй, но система охлаждения требует воды — если её не обслуживать каждые 3 дня, внутри будет 50°C. Главная проблема — вода: колодец бункера пересыхает, каждая капля на счету. Еды на 6 месяцев, но она быстро портится от жары. Выходить днём невозможно — кожа лопается. Только ночью, ненадолго. Тот, кто находит воду и поддерживает охлаждение — герой.",
        "Global warming has heated the Earth to 60°C. The bunker is underground, but the cooling system needs water — without service every 3 days, inside hits 50°C too. Water is the biggest problem: the bunker's well is drying up, every drop counts. Food lasts 6 months but spoils fast in the heat. Going outside during the day is impossible — skin blisters. Only at night, briefly. Anyone who finds water and keeps the cooling running is a hero.",
      ),
      usefulTags: [
        "suv-topish",
        "muhandislik",
        "kimyo",
        "issiqqa-chidamli",
        "ta'mirlash",
        "tezda-harakat",
        "tungi-ish",
      ],
      vulnerableTags: [
        "issiqqa-chidamsiz",
        "ko'p-suv-ichadi",
        "qon-bosimi-yuqori",
        "yurak-kasalligi",
        "keksa",
        "foydasiz-ish",
      ],
    },
    {
      key: "zombie",
      name: text(
        "Zombi apokalipsisi",
        "Зомби-апокалипсис",
        "Zombie apocalypse",
      ),
      description: text(
        "Noma'lum virus odamlarni tez va agressiv zombilarga aylantirgan. Bunker shahar chetida — temir eshikli, lekin eshikni ushlash uchun har kuni qarovul kerak. Zombi tishi yoki tirnog'idan kichik chizilish yuqishga olib keladi. Oziq-ovqat 5 oyga, lekin shahar omborlarida hali zaxira bor — tashqariga chiqib olib kelish mumkin, lekin har chiqish o'lim ruletkasi. Shovqin zombi to'plamini chaqiradi. Tunda ovqat olishga chiqish eng yaxshi vaqt.",
        "Неизвестный вирус превратил людей в быстрых и агрессивных зомби. Бункер на окраине города — железная дверь, но её каждый день нужно охранять. Зубы или когти зомби — даже малейшая царапина — заражают. Еды на 5 месяцев, но на складах города ещё есть запасы — за ними можно сходить, но каждый выход — смертельная рулетка. Шум привлекает стаи зомби. Лучшее время для вылазки — ночь.",
        "An unknown virus has turned people into fast, aggressive zombies. The bunker stands on the city's edge — an iron door, but it needs guarding every day. A zombie's bite or scratch — even the smallest cut — transmits the virus. Food lasts 5 months, but city warehouses still have supplies — you can go fetch them, but every trip is a deadly gamble. Noise draws zombie hordes. The best time to scavenge is at night.",
      ),
      usefulTags: [
        "qurol",
        "jang",
        "tez-yugurish",
        "jismoniy-kuch",
        "kuzatuv",
        "jamoaviy-ish",
        "sovuqqonlik",
        "tibbiyot",
      ],
      vulnerableTags: [
        "sekin",
        "tez-charchaydi",
        "oyoq-jarohati",
        "qo'rqoq",
        "shovqinli",
        "keksa",
        "foydasiz-ish",
      ],
    },
  ],
  situations: [
    // ============================================================
    // YADRO URUSHI (nuclear) — 6 situation
    // ============================================================
    sit({
      text: ["Bunker shamollatish filtri zaiflashdi — tashqaridagi radiatsion havo asta-asta sizib kira boshladi. Birinchi belgilarni sog'lig'i zaif odamlar sezadi: bosh og'rig'i, nafas qisish, ko'z achishish. Kim eng oldin og'irlashadi? Uni topib o'g'riqlardan halos qiling", "Фильтр вентиляции бункера ослаб — радиоактивный воздух снаружи начал постепенно просачиваться. Первые признаки заметят те, у кого слабое здоровье: головная боль, одышка, резь в глазах. Кто пострадает первым?", "The bunker's ventilation filter has weakened — radioactive air from outside is slowly seeping in. The first symptoms will hit those with weak health: headaches, shortness of breath, burning eyes. Who will suffer first?"],
      disasters: ["nuclear"],
      tier: 1,
      highlight: ["sog'lom", "immunitet-kuchli", "jismoniy-kuch"],
      weak: [
        "astma",
        "yurak-kasalligi",
        "surunkali-kasallik",
        "qon-bosimi-yuqori",
        "keksa",
      ],
      reason: ["radiatsion havoga eng chidamsiz", "самый уязвимый к радиоактивному воздуху", "least resistant to radioactive air"],
    }),
    sit({
      text: ["Generator dizel yoqilg'isi kamayib bormoqda — 1 oydan keyin chiroq ham, isitish ham, suv tozalovchi ham o'chadi. Texnik bilim yoki muqobil energiya manbaini yarata oladigan kishilar zarur. Foydasiz kasb bu vaziyatda ortiqcha yuk.", "Дизельное топливо для генератора заканчивается — через месяц погаснет свет, отключится отопление и водоочистка. Нужен человек с техническими знаниями или способный создать альтернативный источник энергии. Бесполезная профессия в этой ситуации — лишний груз.", "The generator's diesel fuel is running low — in a month the lights, heat, and water purifier all shut down. We need someone with technical knowledge or who can build an alternative energy source. A useless profession here is dead weight."],
      disasters: ["nuclear"],
      tier: 2,
      highlight: ["muhandislik", "texnika", "ta'mirlash", "elektrik"],
      weak: ["foydasiz-ish", "bloger", "dangasa"],
      reason: ["energiya muammosida hech narsa berolmaydigan", "бесполезен в вопросах энергоснабжения", "contributes nothing to the energy problem"],
    }),
    sit({
      text: ["Bunker eshigi germetikligi buzilib qoldi — radiatsiya tezroq kira boshladi. Eshikni qayta ta'mirlash uchun kimdir tashqariga chiqishi kerak. Faqat jismonan kuchli, chidamli va texnik bilimi bor odam qaytib keladi. Kim bizga bu holatda yordam bera olmaydi toping.", "Герметичность двери бункера нарушена — радиация поступает быстрее. Чтобы починить дверь, кто-то должен выйти наружу. Вернётся только сильный, выносливый и знающий технику. Для остальных выйти — значит не вернуться.", "The bunker door's seal is broken — radiation is entering faster. Someone has to go outside to fix it. Only a physically strong, durable, and technically skilled person comes back. For anyone else, going out means not returning."],
      disasters: ["nuclear"],
      tier: 3,
      highlight: [
        "muhandislik",
        "ta'mirlash",
        "jismoniy-kuch",
        "chidamlilik",
        "quruvchi",
      ],
      weak: [
        "surunkali-kasallik",
        "astma",
        "keksa",
        "tez-charchaydi",
        "oyoq-jarohati",
        "qo'rqoq",
      ],
      reason: ["tashqariga chiqib qaytib kelolmaydigan", "не сможет вернуться после выхода наружу", "won't survive going outside"],
    }),
    sit({
      text: ["Bunker ichida radiatsion himoya qatlamini qayta qurish kerak — eski qoplama yorilib qolgan. Bu ish jismoniy mehnat va qurilish ko'nikmasini talab qiladi. Foydasiz kasb yoki jismonan zaif odam bu rolga to'g'ri kelmaydi.", "Внутри бункера нужно перестроить радиационный защитный слой — старая обшивка треснула. Эта работа требует физического труда и строительных навыков. Бесполезная профессия или физически слабый человек не подходит.", "The radiation shielding inside the bunker needs to be rebuilt — the old layer has cracked. This requires physical labor and construction skill. A useless profession or physically weak person isn't fit for the role."],
      disasters: ["nuclear"],
      tier: 3,
      highlight: ["quruvchi", "muhandislik", "ta'mirlash", "jismoniy-kuch"],
      weak: ["foydasiz-ish", "tez-charchaydi", "oyoq-jarohati", "dangasa"],
      reason: ["qurilish ishiga yaramaydigan", "непригоден для строительных работ", "no use for construction work"],
    }),
    sit({
      text: [
        "Tibbiy zaxira tugab bormoqda. Surunkali kasalligi bor odamlarga doimiy dori kerak, lekin dori cheklangan. Dori berilmagan kishi keyingi oyda yashay olmaydi. Eng ko'p tibbiy yordamga muhtoj  bo'lmagan kishilarni qoldirish — barchaning hayotini saqlash demak.",
        "Медицинские запасы заканчиваются. Хронически больным нужны постоянные лекарства, но они ограничены. Тот, кто не получит дозу, не проживёт и месяц. Оставить самого нуждающегося в помощи — значит спасти остальных.",
        "Medical supplies are running out. The chronically ill need constant medication, but the stock is limited. Anyone left without doses won't survive the next month. Leaving behind the most dependent saves everyone else.",
      ],
      disasters: ["nuclear"],
      tier: 4,
      highlight: ["sog'lom", "tibbiyot", "immunitet-kuchli"],
      weak: [
        "surunkali-kasallik",
        "diabet",
        "yurak-kasalligi",
        "doimiy-og'riq",
        "tibbiy-yordamga-muhtoj",
      ],
      reason: ["doimiy dori talab qiladigan va siz bermaganda yashay olmaydigan", "требует постоянных лекарств и без них не выживет", "needs constant medication and won't survive without it"],
    }),
    sit({
      text: ["Radiatsiya tushishi 2 yil — bunker shu vaqt yashash uchun mo'ljallangan. Lekin oziq-ovqat va resurslar kamayib bormoqda. Insoniyat kelajagi yosh va sog'lom odamlardan davom etishi kerak. Eng kam hissa qo'sha oladigan, eng kam yashash imkoniyatiga ega kishi qolmaydi.", "Радиация спадёт через 2 года — бункер рассчитан на этот срок. Но еда и ресурсы тают. Будущее человечества зависит от молодых и здоровых. Тот, кто внесёт наименьший вклад и у кого меньше шансов выжить, не останется.", "Radiation will subside in 2 years — that's how long the bunker was built for. But food and resources are shrinking. Humanity's future depends on the young and healthy. Whoever contributes least and has the lowest chance of survival stays behind."],
      disasters: ["nuclear"],
      tier: 5,
      highlight: [
        "yosh",
        "sog'lom",
        "aql",
        "muhandislik",
        "tibbiyot",
        "ovchilik",
      ],
      weak: [
        "keksa",
        "surunkali-kasallik",
        "foydasiz-ish",
        "tibbiy-yordamga-muhtoj",
      ],
      reason: ["yangi dunyoga eng kam hissa qo'sha oladigan", "принесёт меньше всего пользы в новом мире", "contributes the least to the new world"],
    }),

    sit({
      text: ["Bunker eshigi yaqinidagi radiatsiya o'lchagich noma'lum sababdan ishlamayapti. Qurilmani tekshirib, xavfsizlikni ta'minlay oladigan texnik kishi tezda kerak. Bu vaziyatga yordam bera olmaydigon kimnidir qurbon qiling", "Дозиметр у двери бункера по неизвестной причине вышел из строя. Срочно нужен технарь, который проверит прибор и обеспечит безопасность.", "The radiation meter by the bunker door has stopped working for unknown reasons. We urgently need a technician who can check the device and confirm safety."],
      disasters: ["nuclear"],
      tier: 1,
      highlight: ["muhandislik", "elektrik", "kimyo", "texnika"],
      weak: ["foydasiz-ish", "bloger", "dangasa"],
      reason: ["radiatsiya qurilmasini tekshira olmaydigan", "не может проверить дозиметр", "can't inspect the radiation meter"],
    }),
    sit({
      text: ["Bunker ichida changga aylanmagan toza joy faqat 30 m². Bu joyda yashash uchun intizom va tartib kerak. Iflos, sabrsiz yoki egoist kishi makonni buzadi.", "В бункере чистого, не запылённого места всего 30 м². Чтобы здесь жить, нужны дисциплина и порядок. Неопрятный, нетерпеливый или эгоистичный человек разрушит это пространство.", "Only 30 m² inside the bunker is clean and dust-free. Living here requires discipline and order. A messy, impatient, or selfish person will ruin the space."],
      disasters: ["nuclear"],
      tier: 2,
      highlight: ["intizomli", "sog'lom", "jamoaviy-ish"],
      weak: ["dangasa", "sabrsiz", "egoist", "jahldor"],
      reason: ["tor joyda boshqalar bilan tartibli yashay olmaydigan", "не умеет жить рядом с другими в тесноте", "can't share tight quarters cleanly with others"],
    }),
    sit({
      text: ["Radiatsion qor bunker tomiga tushdi — uni suvga aylantirish maxsus kimyoviy filtrlash talab qiladi. Kimyogar yoki texnik bilim shart.", "На крыше бункера выпал радиоактивный снег — чтобы превратить его в воду, нужна химическая фильтрация. Без химика или технического специалиста не обойтись.", "Radioactive snow has fallen on the bunker's roof — turning it into water requires chemical filtration. A chemist or technical expert is essential."],
      disasters: ["nuclear"],
      tier: 3,
      highlight: ["kimyo", "muhandislik", "suv-topish", "ta'mirlash"],
      weak: ["foydasiz-ish", "bloger"],
      reason: ["radiatsion suvni toza qila olmaydigan", "не сможет очистить радиоактивную воду", "can't purify radioactive water"],
    }),
    sit({
      text: ["Eski qoldiq aloqa qurilmasi topildi — boshqa bunkerlar bilan bog'lanish imkoniyati. Lekin u faqat texnik bilim bilan ishlaydi. Aloqa o'rnatilmasa, biz yolg'iz qolamiz.", "Найдено старое радиоустройство — шанс связаться с другими бункерами. Но оно требует технических знаний. Без связи мы останемся одни.", "An old communications device has been found — a chance to contact other bunkers. But it only works with technical know-how. Without a connection, we're alone."],
      disasters: ["nuclear"],
      tier: 3,
      highlight: ["muhandislik", "elektrik", "texnika", "eski-uslublar"],
      weak: ["foydasiz-ish", "bloger", "texnologiyaga-bog'liq"],
      reason: ["aloqani qura olmaydigan", "не способен наладить связь", "can't establish communication"],
    }),
    sit({
      text: ["Boshqa bunker radio orqali yordam so'radi. Ularga oziq-ovqat berish — bizning resursni kamaytirish. Bermaslik — ularning o'limi. Aqlli, sovuqqon qaror kerak.", "Другой бункер просит помощи по радио. Дать им еду — потерять часть своих запасов. Отказать — обречь их на смерть. Нужно умное, хладнокровное решение.", "Another bunker is asking for help over the radio. Giving them food means draining our supplies. Refusing means their death. We need a smart, cold-blooded call."],
      disasters: ["nuclear"],
      tier: 4,
      highlight: ["aql", "sovuqqonlik", "lider", "ishonchli"],
      weak: ["jahldor", "sabrsiz", "egoist", "qo'rqoq"],
      reason: ["qiyin qaror qabul qila olmaydigan", "не сможет принять трудное решение", "can't make a hard call"],
    }),
    sit({
      text: ["Radiatsiya darajasi bunker filtrini yorib o'tdi — ichkari ham endi xavfli. Sog'lig'i eng zaif kishi birinchi belgilarni ko'rsatadi va keyingi 1 oyda halok bo'ladi.", "Уровень радиации пробил фильтр бункера — внутри тоже стало опасно. У того, у кого здоровье самое слабое, симптомы появятся первыми, и в течение месяца он погибнет.", "Radiation has breached the bunker's filter — even inside is now dangerous. The person with the weakest health will show symptoms first and die within a month."],
      disasters: ["nuclear"],
      tier: 5,
      highlight: ["sog'lom", "immunitet-kuchli", "yosh", "jismoniy-kuch"],
      weak: [
        "surunkali-kasallik",
        "immunitet-zaif",
        "astma",
        "keksa",
        "yurak-kasalligi",
      ],
      reason: ["filtrsiz havoda eng oldin halok bo'ladigan", "погибнет первым в неотфильтрованном воздухе", "first to die in unfiltered air"],
    }),

    // ============================================================
    // GLOBAL VIRUS (virus) — 6 situation
    // ============================================================
    sit({
      text: ["Birinchi yo'tal eshitildi. Hali aniqlanmagan — oddiy zukam yoki yangi to'lqin. Lekin guruh xavotirda: virus 2 hafta yashirin yurishi mumkin. Sog'lig'i zaif odam shubha ostida.", "Раздался первый кашель. Пока непонятно — обычная простуда или новая волна. Но группа напряжена: вирус может скрываться 2 недели. Под подозрением — те, у кого слабое здоровье.", "The first cough rang out. Still unclear — common cold or new wave? But the group is tense: the virus can hide for 2 weeks. Whoever has weak health is under suspicion."],
      disasters: ["virus"],
      tier: 1,
      highlight: ["sog'lom", "immunitet-kuchli"],
      weak: ["surunkali-kasallik", "immunitet-zaif", "astma", "allergiya"],
      reason: ["kasallik belgilarini birinchi ko'rsatishi mumkin bo'lgan", "раньше других покажет признаки болезни", "likely to show symptoms first"],
    }),
    sit({
      text: ["Karantin xonasi tayyorlandi — faqat 1 kishi joylashishi mumkin. Lekin karantindagi odam o'zini-o'zi davolashi shart. Tibbiy bilim yo'q kishi karantinda nobud bo'ladi va kasallik tarqaladi.", "Подготовлена карантинная комната — только на одного. Но изолированный должен лечить себя сам. Без медицинских знаний человек погибнет в карантине, а болезнь распространится.", "A quarantine room is ready — fits only one. But whoever is isolated has to treat themselves. Without medical knowledge they'll die in quarantine and the disease will spread."],
      disasters: ["virus"],
      tier: 2,
      highlight: ["tibbiyot", "shifo", "intizomli", "sovuqqonlik"],
      weak: ["foydasiz-ish", "qo'rqoq", "dangasa"],
      reason: ["karantinda o'zini boshqara olmaydigan", "не справится с собой в карантине", "can't manage themselves in quarantine"],
    }),
    sit({
      text: ["Dorilar tugab bormoqda. Surunkali kasallikka muhtoj kishilar keyingi 2 hafta ichida halok bo'ladi. Davo bera olmagan kishini saqlash — boshqalarni o'limga mahkum qilish.", "Лекарства заканчиваются. Хронически больные погибнут в течение 2 недель. Оставить того, кого нечем лечить — обречь остальных на смерть.", "Medicine is running out. The chronically ill will die within 2 weeks. Keeping someone we can't treat means dooming the rest."],
      disasters: ["virus"],
      tier: 3,
      highlight: ["sog'lom", "tibbiyot"],
      weak: [
        "diabet",
        "yurak-kasalligi",
        "doimiy-og'riq",
        "tibbiy-yordamga-muhtoj",
        "qandli-diabet",
      ],
      reason: ["doimiy davoga muhtoj va saqlanishi guruhga qiziqarli emas", "нуждается в постоянном лечении и тащит группу вниз", "needs constant care and drags the group down"],
    }),
    sit({
      text: ["Bunkerga zararlangan oziq-ovqat tushdi — qaysi paketda virus borligi noma'lum. Hammasini iste'mol qilish kerak. Immuniteti zaif kishilar zaharlanadi va kasallik tarqatadi.", "В бункер попала заражённая еда — неизвестно, в каком пакете вирус. Всё придётся съесть. Люди со слабым иммунитетом отравятся и разнесут болезнь.", "Contaminated food has reached the bunker — we don't know which package carries the virus. All of it must be eaten. People with weak immunity will get sick and spread the disease."],
      disasters: ["virus"],
      tier: 3,
      highlight: ["immunitet-kuchli", "sog'lom", "jismoniy-kuch"],
      weak: [
        "immunitet-zaif",
        "surunkali-kasallik",
        "keksa",
        "qandli-diabet",
        "allergiya",
      ],
      reason: ["zararlangan ovqatdan birinchi zaharlanadigan", "первым отравится заражённой едой", "first to be poisoned by contaminated food"],
    }),
    sit({
      text: ["Virus mutatsiya bo'ldi — endi havoda tarqaladi. Karantin tartibini saqlay olmaydigan, intizomsiz odam butun bunkerni o'lim ostiga qo'yadi. Bir kichik xato — barcha halok bo'ladi.", "Вирус мутировал — теперь передаётся по воздуху. Тот, кто не соблюдает карантин, недисциплинированный — подставляет под смерть весь бункер. Одна маленькая ошибка — и все погибли.", "The virus has mutated — now airborne. Anyone who can't follow quarantine rules puts the whole bunker at risk. One small mistake kills everyone."],
      disasters: ["virus"],
      tier: 4,
      highlight: ["intizomli", "sovuqqonlik", "tibbiyot", "aql"],
      weak: ["dangasa", "sabrsiz", "egoist", "jahldor", "pranker", "hazilkash"],
      reason: ["karantin tartibini buzib hammani xavfga qo'yadigan", "нарушает карантин и подвергает всех опасности", "breaks quarantine and endangers everyone"],
    }),
    sit({
      text: ["So'nggi vaksina dozasi — faqat 1 kishiga yetadi. Qolganlardan eng kuchsiz immunitetli kishi keyingi to'lqinda omon qolmaydi. Tanlov shafqatsiz: kim eng oldin yo'qotiladi?", "Последняя доза вакцины — только на одного. Из остальных тот, у кого иммунитет слабее всех, не переживёт следующую волну. Выбор жесток: кого отдать первым?", "The last vaccine dose — only one shot. Of the rest, whoever has the weakest immunity won't survive the next wave. The choice is brutal: who goes first?"],
      disasters: ["virus"],
      tier: 5,
      highlight: ["sog'lom", "immunitet-kuchli", "yosh", "jismoniy-kuch"],
      weak: [
        "keksa",
        "surunkali-kasallik",
        "immunitet-zaif",
        "astma",
        "qandli-diabet",
      ],
      reason: ["vaksinasiz to'lqinda birinchi halok bo'ladigan", "погибнет первым без вакцины", "first to die without a vaccine"],
    }),

    sit({
      text: ["Bunker havosi tutmoqda — kimdir tunda noo'rin yo'tal qildi. Hozircha kasallikmi yoki oddiy shamollashmi noma'lum. Sog'lig'i zaif kishi birinchi shubha ostida.", "Воздух в бункере стал спёртым — кто-то ночью странно кашлял. Пока непонятно: болезнь или простуда. Под первым подозрением — слабый здоровьем.", "The bunker air is stale — someone coughed strangely in the night. Unclear yet — illness or just a cold. Weak health draws the first suspicion."],
      disasters: ["virus"],
      tier: 1,
      highlight: ["sog'lom", "immunitet-kuchli"],
      weak: ["astma", "surunkali-kasallik", "yurak-kasalligi", "allergiya"],
      reason: ["yo'tal va kasallik belgilarini birinchi ko'rsatishi mumkin bo'lgan", "скорее всего первым проявит кашель и болезнь", "most likely to cough and show symptoms first"],
    }),
    sit({
      text: ["Tibbiyot zaxirasi kamayib bormoqda — shifoxonadan dori-darmon olib kelish kerak. Tashqari xavfli, lekin tibbiyot va jismoniy ish birga kerak.", "Медицинские запасы тают — нужно сходить за лекарствами в больницу. Снаружи опасно, и от человека нужны и медицинские знания, и физическая сила.", "Medical supplies are dwindling — someone needs to fetch drugs from the hospital. Outside is dangerous, and we need both medical knowledge and physical strength."],
      disasters: ["virus"],
      tier: 2,
      highlight: [
        "tibbiyot",
        "jismoniy-kuch",
        "omon-qolish",
        "qurol",
        "tezda-harakat",
      ],
      weak: [
        "keksa",
        "oyoq-jarohati",
        "qo'rqoq",
        "foydasiz-ish",
        "tez-charchaydi",
      ],
      reason: ["tashqaridan dori olib kelolmaydigan", "не сможет принести лекарства снаружи", "can't bring back medicine from outside"],
    }),
    sit({
      text: ["Bunker dezinfeksiya tizimi buzildi. Kimyoviy bilim yoki texnik aql bilan qayta yig'ish kerak. Aks holda mikroblar tez tarqaydi.", "Система дезинфекции бункера сломалась. Нужны химик или технарь, чтобы собрать её заново. Иначе микробы разнесутся быстро.", "The bunker's disinfection system has failed. We need a chemist or a technician to rebuild it. Otherwise germs will spread fast."],
      disasters: ["virus"],
      tier: 2,
      highlight: ["kimyo", "muhandislik", "tibbiyot", "ta'mirlash"],
      weak: ["foydasiz-ish", "bloger", "dangasa"],
      reason: ["dezinfeksiya tizimini ta'mirlay olmaydigan", "не сможет починить дезинфекцию", "can't repair the disinfection system"],
    }),
    sit({
      text: ["Karantinda yotgan kishi vafot etdi — tanani chiqarib yuborish kerak. Lekin u virusli, hech kim tegmasligi kerak. Sovuqqon va tibbiy ko'nikma bor odam.", "Тот, кто лежал в карантине, умер — тело нужно вынести. Но он заражён, прикасаться нельзя. Нужен хладнокровный с медицинскими навыками.", "The person in quarantine died — the body has to be removed. But it's infectious, no one can touch it. We need someone cold-blooded with medical training."],
      disasters: ["virus"],
      tier: 3,
      highlight: ["tibbiyot", "sovuqqonlik", "jismoniy-kuch", "intizomli"],
      weak: ["qo'rqoq", "sabrsiz", "surunkali-kasallik", "tez-charchaydi"],
      reason: ["yuqumli tanani xavfsiz olib chiqolmaydigan", "не вынесет заражённое тело без риска", "can't remove the infected body safely"],
    }),
    sit({
      text: ["Bunker oxirgi antiseptiklari tugadi — endi har bir teginish xavf. Intizomsiz, tartibsiz kishi qo'lini yuvmaydi, hammani kasal qiladi.", "Последние антисептики кончились — теперь каждое касание опасно. Недисциплинированный, неаккуратный не моет руки и заражает всех.", "The last antiseptics are gone — every touch is now a hazard. An undisciplined, sloppy person doesn't wash up and infects everyone."],
      disasters: ["virus"],
      tier: 4,
      highlight: ["intizomli", "tibbiyot", "sovuqqonlik", "jamoaviy-ish"],
      weak: ["dangasa", "sabrsiz", "jahldor", "egoist", "pranker"],
      reason: ["tartibsizligi tufayli butun guruhga kasallik tarqatishi mumkin bo'lgan", "из-за неряшливости рискует заразить всех", "could spread sickness through pure carelessness"],
    }),
    sit({
      text: ["Virus mutatsiya bo'ldi — havo orqali tarqaladi. Hech kim bir xonada bo'la olmaydi. Eng kasal, immuniteti eng zaif kishi karantinda halok bo'ladi.", "Вирус мутировал — передаётся по воздуху. Никому нельзя быть в одной комнате. Самый больной, с самым слабым иммунитетом, погибнет в карантине.", "The virus mutated — airborne now. No two people can share a room. The sickest, weakest immunity, will die in quarantine."],
      disasters: ["virus"],
      tier: 5,
      highlight: ["sog'lom", "immunitet-kuchli", "yosh", "jismoniy-kuch"],
      weak: [
        "immunitet-zaif",
        "surunkali-kasallik",
        "astma",
        "keksa",
        "doimiy-og'riq",
        "qandli-diabet",
      ],
      reason: ["yangi to'lqinda omon qolmaydigan", "не переживёт новую волну", "won't survive the next wave"],
    }),

    // ============================================================
    // AI ISYONI (ai) — 6 situation
    // ============================================================
    sit({
      text: ["Bunker yaqinida elektron signal aniqlandi — kimdadir telefon, soat yoki boshqa qurilma qolgan. Signal topilsa, dronlar 10 daqiqada keladi. Texnologiyaga bog'liq, e'tibor tortadigan kishi xavf manbai.", "Рядом с бункером засекли электронный сигнал — у кого-то остался телефон, часы или другой прибор. Если сигнал найдут, дроны прилетят за 10 минут. Привязанный к технологиям, привлекающий внимание — источник угрозы.", "An electronic signal has been detected near the bunker — someone still has a phone, smartwatch, or other device. If found, drones arrive in 10 minutes. Anyone tech-dependent or attention-grabbing is a threat."],
      disasters: ["ai"],
      tier: 1,
      highlight: ["eski-uslublar", "intizomli", "sovuqqonlik"],
      weak: [
        "texnologiyaga-bog'liq",
        "bloger",
        "signal-chiqaradi",
        "e'tibor-tortadi",
      ],
      reason: ["elektron signal yoki e'tibor tortib AI'ga manzilni beruvchi", "излучает сигнал или привлекает внимание, выдавая бункер ИИ", "leaks a signal or draws attention, exposing the bunker to the AI"],
    }),
    sit({
      text: ["Generator boshqaruv tizimi buzildi — eski sxemada qayta ulash kerak. Faqat dasturlash yoki elektronikadan tushunadigan kishi tuzata oladi. Bu ish bajarilmasa, butun bunker qorong'i va sovuq.", "Система управления генератором сломалась — нужно перепаять по старой схеме. Починит только тот, кто разбирается в программировании или электронике. Иначе весь бункер останется без света и тепла.", "The generator's control system has failed — we need to rewire it from an old schematic. Only someone with programming or electronics know-how can fix it. Otherwise the whole bunker goes dark and cold."],
      disasters: ["ai"],
      tier: 2,
      highlight: ["muhandislik", "texnika", "ta'mirlash", "elektrik"],
      weak: ["foydasiz-ish", "bloger", "dangasa"],
      reason: ["texnik muammoda hech narsa berolmaydigan", "бесполезен в технической проблеме", "no help with technical problems"],
    }),
    sit({
      text: ["Tashqarida dron uchish ovozi — bunker ustidan o'tib ketmoqda. Endi har kim shovqinsiz va harakatsiz turishi shart. Sabrsiz, shovqinli yoki jahli tez kishi bir daqiqada hammani fosh qiladi.", "Снаружи звук дрона — он пролетает над бункером. Теперь все должны замереть и молчать. Нетерпеливый, шумный или вспыльчивый за минуту сдаст всех.", "A drone's hum outside — it's passing over the bunker. Everyone has to freeze and stay silent. An impatient, noisy, or hot-tempered person will expose us all in a minute."],
      disasters: ["ai"],
      tier: 3,
      highlight: ["sabr", "sovuqqonlik", "intizomli", "aql"],
      weak: ["sabrsiz", "jahldor", "pranker", "hazilkash", "qo'rqoq"],
      reason: ["shovqin yoki harakat bilan bunkerni fosh qiladigan", "выдаст бункер шумом или движением", "would give the bunker away with noise or movement"],
    }),
    sit({
      text: ["Bunker eshigi yaqinida robot kuzatuv kameralari aniqlandi. Yashirin o'chirish kerak — texnik bilim va sovuqqonlik bir vaqtda kerak. Qo'rqib qolgan, shoshilgan kishi ish davomida ushlanadi.", "Возле двери бункера обнаружили роботизированные камеры наблюдения. Их нужно тайно отключить — нужны и техника, и хладнокровие. Запаниковавший или торопливый попадётся.", "Robotic surveillance cameras have been spotted near the bunker door. They must be disabled in secret — both technical skill and a cool head are needed. A panicked or hasty person will get caught."],
      disasters: ["ai"],
      tier: 3,
      highlight: ["muhandislik", "sovuqqonlik", "aql", "kuzatuv", "intizomli"],
      weak: ["qo'rqoq", "sabrsiz", "shovqinli", "jahldor"],
      reason: ["yashirin operatsiyada sovuqqonlik yetishmasligi", "не хватит хладнокровия для скрытной операции", "lacks composure for a stealth operation"],
    }),
    sit({
      text: ["AI bunker manzilini taxminladi — ko'chish vaqti keldi. Yangi joyga uzoq, og'ir piyoda yo'l. Tez yura olmaydigan, jismonan zaif kishi yo'lda nobud bo'ladi va guruhni sekinlashtiradi.", "ИИ вычислил местоположение бункера — пора уходить. До нового убежища долгий, тяжёлый пеший путь. Тот, кто не успевает или физически слаб, погибнет по пути и замедлит группу.", "The AI has located the bunker — time to move. A long, hard trek to the new shelter. Anyone slow or physically weak dies along the way and slows the group."],
      disasters: ["ai"],
      tier: 4,
      highlight: [
        "jismoniy-kuch",
        "chidamlilik",
        "tez-yugurish",
        "omon-qolish",
      ],
      weak: [
        "keksa",
        "tez-charchaydi",
        "oyoq-jarohati",
        "sekin",
        "surunkali-kasallik",
      ],
      reason: ["uzoq yo'lda guruhni sekinlashtirib o'limga olib keladigan", "замедлит группу в долгом пути и приведёт всех к гибели", "would slow the group on the long road and get them all killed"],
    }),
    sit({
      text: ["AI hatto eski texnologiyalarni ham nazoratga oldi. Endi butunlay texnologiyasiz hayot — qadimgi uslublar bilan ovqat, suv, isish. Zamonaviy kasbga bog'liq, eski ko'nikmalarsiz odam yangi dunyoda omon qolmaydi.", "ИИ контролирует даже старые технологии. Жизнь теперь без техники вовсе — еда, вода, тепло — по древним способам. Тот, чья профессия современная и кто не владеет старыми навыками, не выживет в новом мире.", "The AI now controls even the old technologies. Life is fully tech-free — food, water, heat — all done the old way. Anyone tied to a modern profession with no traditional skills won't survive the new world."],
      disasters: ["ai"],
      tier: 5,
      highlight: [
        "eski-uslublar",
        "omon-qolish",
        "ovchilik",
        "o't-yoqish",
        "ferma",
        "dehqonchilik-ichki",
      ],
      weak: [
        "texnologiyaga-bog'liq",
        "bloger",
        "foydasiz-ish",
        "dating-ekspert",
      ],
      reason: ["texnologiyasiz hayotda hech qanday ko'nikma berolmaydigan", "не может ничего предложить в жизни без технологий", "offers nothing in a tech-free life"],
    }),

    sit({
      text: ["Bunker yuqorisida dron uchish izlari aniqlandi — AI bizning manzilni gumonlamoqda. Endi har bir signal, har bir kichik harakat hisobda. E'tibor tortadigan kishi xavf manbai.", "Над бункером замечены следы дронов — ИИ начинает подозревать наше место. Теперь каждый сигнал и каждое движение на учёте. Тот, кто привлекает внимание, — угроза.", "Drone traces have been spotted above the bunker — the AI suspects our location. Every signal and every small move now counts. Anyone who draws attention is a threat."],
      disasters: ["ai"],
      tier: 1,
      highlight: ["sovuqqonlik", "intizomli", "sabr", "kuzatuv"],
      weak: [
        "shovqinli",
        "jahldor",
        "pranker",
        "signal-chiqaradi",
        "bloger",
        "e'tibor-tortadi",
      ],
      reason: ["AI'ning e'tiborini bunkerga tortishi mumkin bo'lgan", "рискует привлечь внимание ИИ к бункеру", "could draw the AI's attention to the bunker"],
    }),
    sit({
      text: ["Eski mexanik nasos shart — AI nazoratidan tashqarida ishlaydi. Faqat texnik tushuncha yoki eski mexanika biladigan kishi qura oladi.", "Нужен старый механический насос — он работает вне контроля ИИ. Собрать его сможет только техник или знающий старую механику.", "An old mechanical pump is needed — it works outside the AI's control. Only a technician or someone who knows old mechanics can build it."],
      disasters: ["ai"],
      tier: 2,
      highlight: ["muhandislik", "ta'mirlash", "eski-uslublar", "texnika"],
      weak: ["foydasiz-ish", "texnologiyaga-bog'liq", "bloger"],
      reason: ["mexanik nasos qura olmaydigan", "не построит механический насос", "can't build a mechanical pump"],
    }),
    sit({
      text: ["Bunker eshigida AI sensor topildi. Mexanikani buzmasdan yashirin o'chirib qo'yish kerak — texnik bilim va sovuqqonlik bir vaqtda.", "У двери бункера обнаружен сенсор ИИ. Нужно отключить его скрытно, не повредив механику — требуются и техника, и выдержка.", "An AI sensor has been found at the bunker door. It must be quietly disabled without damaging the mechanism — both technical skill and composure required."],
      disasters: ["ai"],
      tier: 2,
      highlight: ["muhandislik", "elektrik", "sovuqqonlik", "aql", "kuzatuv"],
      weak: ["jahldor", "sabrsiz", "foydasiz-ish", "qo'rqoq"],
      reason: ["yashirin texnik operatsiyani bajara olmaydigan", "не справится со скрытной технической операцией", "can't pull off a stealth technical job"],
    }),
    sit({
      text: ["Tashqarida butun shahar yo'q — AI hammasini buzgan. Suv va ovqat topish uchun yashirin yo'l bilan o'tish kerak. Sezgir, sovuqqon va sabrli kishilar.", "Город снаружи уничтожен — ИИ разрушил всё. За водой и едой нужно идти скрытными тропами. Подходят только наблюдательные, хладнокровные, терпеливые.", "The city outside is gone — the AI destroyed it. Finding water and food means moving along hidden routes. Only the observant, cold-blooded, and patient will do."],
      disasters: ["ai"],
      tier: 3,
      highlight: ["sovuqqonlik", "kuzatuv", "omon-qolish", "intizomli", "sabr"],
      weak: ["shovqinli", "sabrsiz", "oyoq-jarohati", "qo'rqoq", "jahldor"],
      reason: ["yashirin yo'lda bardosh bera olmaydigan", "не выдержит скрытного похода", "won't hold up on a stealth route"],
    }),
    sit({
      text: ["AI bunker manzilini topdi — dronlar yo'lda. Yashirinish uchun chuqurroq pastga ko'chish kerak, yangi joy kichik. 1 kishi sig'maydi.", "ИИ нашёл бункер — дроны уже в пути. Нужно перебраться ещё глубже, но новое место маленькое. Один человек не поместится.", "The AI has located the bunker — drones are inbound. We have to relocate deeper, but the new spot is small. One person won't fit."],
      disasters: ["ai"],
      tier: 4,
      highlight: [
        "tezda-harakat",
        "sovuqqonlik",
        "aql",
        "jismoniy-kuch",
        "omon-qolish",
      ],
      weak: [
        "keksa",
        "oyoq-jarohati",
        "sekin",
        "foydasiz-ish",
        "tez-charchaydi",
      ],
      reason: ["yangi tor joyda guruhga yuk bo'ladigan", "станет обузой в новом тесном укрытии", "would be a burden in the new tight shelter"],
    }),
    sit({
      text: ["AI butun yerni nazoratga oldi. Insoniyat kelajagi — texnologiyasiz hayot, qadimgi ko'nikmalar. Yangi dunyoga zamonaviy odamning foydasi yo'q.", "ИИ контролирует всю землю. Будущее человечества — жизнь без техники, древние навыки. Современный человек не пригодится новому миру.", "The AI controls the whole planet. Humanity's future is a life without technology, using ancient skills. A modern person has no use in the new world."],
      disasters: ["ai"],
      tier: 5,
      highlight: [
        "ovchilik",
        "ferma",
        "eski-uslublar",
        "omon-qolish",
        "o't-yoqish",
        "dehqonchilik-ichki",
      ],
      weak: [
        "bloger",
        "texnologiyaga-bog'liq",
        "dating-ekspert",
        "foydasiz-ish",
      ],
      reason: ["texnologiyasiz dunyoga hech qanday ko'nikma berolmaydigan", "не сможет дать ничего миру без технологий", "offers nothing to a world without technology"],
    }),

    // ============================================================
    // MUZ DAVRI (ice) — 6 situation
    // ============================================================
    sit({
      text: ["Birinchi sovuq to'lqin — bunker ichi ham -5°C ga tushdi. Yurak kasalligi, qon bosimi muammosi bor odamlar birinchi bo'lib og'irlashadi. Sovuqqa chidamsiz kishi tirik qolish imkoniyati past.", "Первая волна холода — внутри бункера тоже -5°C. У сердечников и гипертоников первыми начнутся проблемы. У того, кто плохо переносит холод, шансов выжить мало.", "The first cold wave — even inside the bunker hits -5°C. People with heart or blood-pressure issues will struggle first. Anyone vulnerable to cold has low survival odds."],
      disasters: ["ice"],
      tier: 1,
      highlight: ["jismoniy-kuch", "chidamlilik", "sog'lom"],
      weak: [
        "sovuqqa-chidamsiz",
        "yurak-kasalligi",
        "qon-bosimi-yuqori",
        "tez-charchaydi",
        "keksa",
      ],
      reason: ["sovuqqa eng chidamsiz va birinchi og'irlashadigan", "хуже всех переносит холод и первым сломается", "least cold-tolerant and first to break down"],
    }),
    sit({
      text: ["Yoqilg'i zaxirasi tezroq tugayapti. Issiqlikni saqlash uchun choralar kerak: o't yoqish, qatlanish, ovqatni tejash. Foydasiz odam ortiqcha issiqlik va oziq-ovqat sarflaydi.", "Топливо тает быстрее, чем рассчитывали. Нужно беречь тепло: разводить огонь, кутаться, экономить еду. Бесполезный лишь тратит тепло и еду впустую.", "Fuel is running out faster than expected. We need to conserve heat: build fires, layer up, ration food. A useless person just burns through warmth and food."],
      disasters: ["ice"],
      tier: 2,
      highlight: ["o't-yoqish", "muhandislik", "issiq-kiyim", "intizomli"],
      weak: ["foydasiz-ish", "ko'p-ovqat", "dangasa", "egoist"],
      reason: ["resurs sarflab guruhga foyda bermaydigan", "тратит ресурсы и ничего не даёт группе", "consumes resources without giving anything back"],
    }),
    sit({
      text: ["Ovqat 1 oyga qoldi — ov qilish shart. Lekin tashqari -40°C, tinch joy yo'q. Faqat jismonan kuchli, ovchilik biladigan va sovuqqa chidamli odam qaytib keladi.", "Еды осталось на месяц — нужно охотиться. Но снаружи -40°C, безопасных мест нет. Вернётся только сильный, умеющий охотиться и переносящий холод.", "Food has one month left — we have to hunt. But it's -40°C outside with no safe spot. Only the strong, the hunter, and the cold-resistant will return."],
      disasters: ["ice"],
      tier: 3,
      highlight: [
        "ovchilik",
        "jismoniy-kuch",
        "chidamlilik",
        "qurol",
        "omon-qolish",
        "sovuqqa-chidamli",
        "ovqat-zaxirasi",
      ],
      weak: [
        "sovuqqa-chidamsiz",
        "tez-charchaydi",
        "oyoq-jarohati",
        "keksa",
        "foydasiz-ish",
      ],
      reason: ["tashqarida ov qila olmaydigan", "не справится с охотой снаружи", "can't hunt outside"],
    }),
    sit({
      text: ["Bunker isitma tizimi qisman buzildi — qayta yig'ish kerak, lekin asbob yetarli emas. Texnik aql va jismoniy mehnat bir vaqtda kerak. Aks holda hammani sovuq olib ketadi.", "Система отопления частично сломалась — нужно собрать заново, но инструментов не хватает. Нужны и техническая смекалка, и физический труд. Иначе всех заберёт мороз.", "The heating system is partly broken — must be rebuilt, but tools are scarce. Both technical brains and physical labor are needed. Otherwise the cold takes us all."],
      disasters: ["ice"],
      tier: 3,
      highlight: ["muhandislik", "ta'mirlash", "jismoniy-kuch", "elektrik"],
      weak: ["foydasiz-ish", "tez-charchaydi", "dangasa"],
      reason: ["ta'mirlash ishida hech narsa berolmaydigan", "ничего не даст для ремонта", "useless for the repair job"],
    }),
    sit({
      text: ["Suv tugadi — qorni eritish uchun yoqilg'i ham yo'q. Kimda issiq kiyim, asbob va chidamlilik bor — tashqariga chiqib muqobil topishi mumkin. Aks holda 1 kishi qoladi.", "Вода кончилась — топлива на снег тоже нет. Тот, у кого есть тёплая одежда, инструменты и выносливость, может выйти искать альтернативу. Иначе одного придётся оставить.", "Water is out — no fuel to melt snow either. Whoever has warm gear, tools, and stamina can go look for an alternative. Otherwise one person stays behind."],
      disasters: ["ice"],
      tier: 4,
      highlight: [
        "issiq-kiyim",
        "o't-yoqish",
        "suv-topish",
        "chidamlilik",
        "omon-qolish",
        "sovuqqa-chidamli",
      ],
      weak: ["sovuqqa-chidamsiz", "foydasiz-ish", "keksa", "tez-charchaydi"],
      reason: ["muqobil suv izlay olmaydigan", "не сможет найти альтернативную воду", "can't find an alternative water source"],
    }),
    sit({
      text: ["Bunker oxirgi yoqilg'i porsiyasi qoldi — faqat 5 kishini issiq saqlash mumkin. Eng kam chidamli, sovuqqa eng zaif kishi sovuqda qoladi. Bu o'lim, lekin tanlov muqarrar.", "Осталась последняя порция топлива — хватит согреть только пятерых. Самый невыносливый и слабый к холоду останется на морозе. Это смерть, но выбора нет.", "Only one fuel ration is left — enough warmth for five. The least durable and most cold-vulnerable stays out in the cold. It's death, but the choice is unavoidable."],
      disasters: ["ice"],
      tier: 5,
      highlight: ["chidamlilik", "yosh", "jismoniy-kuch", "sog'lom", "sovuqqa-chidamli"],
      weak: [
        "keksa",
        "sovuqqa-chidamsiz",
        "surunkali-kasallik",
        "yurak-kasalligi",
        "foydasiz-ish",
      ],
      reason: ["sovuqsiz qolsa eng oldin halok bo'ladigan", "погибнет первым без тепла", "first to die without warmth"],
    }),

    sit({
      text: ["Bunker eshigi atrofida qor uyumi paydo bo'ldi — uni doimo tozalab turish kerak. Jismonan kuchli kishi har kuni shu ishni qilishi shart. Foydasiz odam bu yukni ko'tarmaydi.", "Перед дверью бункера намёл сугроб — его нужно регулярно расчищать. Это работа на каждый день для физически сильного. Бесполезный не потянет.", "A snowdrift has piled up at the bunker door — it must be cleared daily. Heavy work for someone physically strong. A useless person won't carry it."],
      disasters: ["ice"],
      tier: 1,
      highlight: ["jismoniy-kuch", "chidamlilik", "intizomli", "sog'lom"],
      weak: [
        "tez-charchaydi",
        "oyoq-jarohati",
        "keksa",
        "foydasiz-ish",
        "dangasa",
      ],
      reason: ["qor tozalashda guruhga yordam berolmaydigan", "не поможет с расчисткой снега", "no help with snow clearing"],
    }),
    sit({
      text: ["Bunker shamollatish tizimi sovuqda muzlab qoldi. Uni iliq tutib turish texnika bilan bog'liq — texnik aql, ta'mirlash ko'nikmasi kerak.", "Вентиляция бункера замёрзла на холоде. Поддерживать её тёплой — задача техническая, нужны инженерные навыки и опыт ремонта.", "The bunker's ventilation has frozen over. Keeping it warm is a technical job — engineering knowledge and repair experience are needed."],
      disasters: ["ice"],
      tier: 2,
      highlight: ["ta'mirlash", "muhandislik", "elektrik", "texnika"],
      weak: ["foydasiz-ish", "dangasa", "bloger"],
      reason: ["ta'mirlash ishini bajara olmaydigan", "не справится с ремонтом", "can't handle the repair"],
    }),
    sit({
      text: ["O'tin tugab bormoqda. Tashqarida muz ostida daraxtlar bor, lekin ularni topish va olib kelish — jismoniy mehnat va navigatsiya talab qiladi.", "Дрова заканчиваются. Под льдом есть деревья, но их нужно найти и принести — это физический труд и ориентирование.", "Firewood is running out. There are trees under the ice, but finding and hauling them takes physical labor and navigation."],
      disasters: ["ice"],
      tier: 2,
      highlight: [
        "ovchilik",
        "jismoniy-kuch",
        "navigatsiya",
        "omon-qolish",
        "chidamlilik",
      ],
      weak: [
        "sovuqqa-chidamsiz",
        "tez-charchaydi",
        "oyoq-jarohati",
        "keksa",
        "foydasiz-ish",
      ],
      reason: ["o'tin topishga chiqib qaytib kelolmaydigan", "не вернётся из похода за дровами", "won't return from the firewood run"],
    }),
    sit({
      text: ["Hayvonlarning bunker yaqiniga kelishi to'xtadi. Ov uchun uzoq, sovuq yo'l. Faqat ovchi, sovuqqa chidamli kishi qaytib keladi.", "Звери перестали подходить к бункеру. Охота — это долгий, холодный путь. Вернётся только охотник, выносливый к морозу.", "Animals have stopped coming near the bunker. Hunting means a long, cold trek. Only a hunter who can handle the cold will return."],
      disasters: ["ice"],
      tier: 3,
      highlight: [
        "ovchilik",
        "chidamlilik",
        "qurol",
        "jismoniy-kuch",
        "omon-qolish",
      ],
      weak: [
        "sovuqqa-chidamsiz",
        "foydasiz-ish",
        "oyoq-jarohati",
        "keksa",
        "tez-charchaydi",
      ],
      reason: ["uzoq sovuq ovga yarayolmaydigan", "не годится для долгой холодной охоты", "not fit for a long cold hunt"],
    }),
    sit({
      text: ["Bunker isitma generatori muzlab qoldi — qayta ishga tushirish uchun texnik va kuchli kishi kerak. Aks holda 6 soatda hamma muzlaydi.", "Генератор отопления в бункере замёрз — чтобы запустить, нужны и техник, и силач. Иначе все замёрзнут за 6 часов.", "The heating generator has frozen — restarting it needs a technician and a strong back together. Otherwise everyone freezes in 6 hours."],
      disasters: ["ice"],
      tier: 4,
      highlight: [
        "muhandislik",
        "jismoniy-kuch",
        "elektrik",
        "ta'mirlash",
        "tezda-harakat",
      ],
      weak: ["foydasiz-ish", "tez-charchaydi", "qo'rqoq", "sekin"],
      reason: ["generatorni tezda qayta ishga tushira olmaydigan", "не сможет быстро запустить генератор", "can't restart the generator in time"],
    }),
    sit({
      text: ["Muz davri uzoq bo'ladi — keyingi yillar uchun yer ostidan dehqonchilik qila olish kerak. Yangi hayot uchun urug', ferma, dehqonchilik bilimi qadrli.", "Ледниковый период затянется — на годы вперёд придётся выращивать еду под землёй. Семена, ферма и аграрные знания становятся самым ценным.", "The ice age will last — for years ahead we'll have to farm underground. Seeds, farming, and agricultural know-how become priceless."],
      disasters: ["ice"],
      tier: 5,
      highlight: [
        "ferma",
        "dehqonchilik-ichki",
        "dehqon",
        "sabr",
        "intizomli",
        "omon-qolish",
      ],
      weak: ["foydasiz-ish", "bloger", "sabrsiz", "dangasa", "dating-ekspert"],
      reason: ["uzoq muddatli dehqonchilikka yaramaydigan", "не подходит для долгого земледелия", "no use for long-term farming"],
    }),

    // ============================================================
    // ISSIQ APOKALIPSIS (heat) — 6 situation
    // ============================================================
    sit({
      text: ["Bunker harorati 35°C ga ko'tarildi. Issiqqa chidamsiz, yurak kasalligi yoki qon bosimi muammosi bor odamlar bosh og'rig'i, ko'rish xiralashishi bilan og'irlasha boshladi.", "Температура в бункере поднялась до 35°C. У не переносящих жару, сердечников и гипертоников начались головная боль и помутнение зрения.", "Temperature in the bunker hit 35°C. People sensitive to heat, with heart or blood-pressure problems, are getting headaches and blurred vision."],
      disasters: ["heat"],
      tier: 1,
      highlight: ["issiqqa-chidamli", "sog'lom"],
      weak: [
        "issiqqa-chidamsiz",
        "yurak-kasalligi",
        "qon-bosimi-yuqori",
        "keksa",
        "surunkali-kasallik",
      ],
      reason: ["issiqlikka birinchi yiqilib qoladigan", "первым свалится от жары", "first to collapse from the heat"],
    }),
    sit({
      text: ["Suv zaxirasi 2 haftaga qoldi — bunker quduqi qurib bormoqda. Suv topa oladigan yoki uni iqtisod qiladigan kishi qadrli. Ko'p suv ichadigan, beparvo kishi guruhga yuk.", "Воды осталось на 2 недели — колодец бункера высыхает. Ценится тот, кто умеет находить воду или экономить её. Тот, кто много пьёт и беспечен — обуза.", "Water has 2 weeks left — the bunker's well is drying. Anyone who can find or conserve water is precious. Heavy drinkers and the careless are a burden."],
      disasters: ["heat"],
      tier: 2,
      highlight: ["suv-topish", "kimyo", "muhandislik", "intizomli"],
      weak: ["ko'p-suv-ichadi", "foydasiz-ish", "egoist", "dangasa"],
      reason: ["suv masalasida hech narsa berolmaydigan va ko'p sarflaydigan", "ничего не даёт по воде и сам много тратит", "contributes nothing on water and consumes a lot"],
    }),
    sit({
      text: ["Sovutish tizimi naychalari yorilib qoldi — bunker 50°C ga qiziy boshladi. Yarim soat ichida ta'mirlanmasa, ichkari yashab bo'lmaydi. Texnik kishi tezda kerak.", "Трубы охлаждения лопнули — бункер раскалился до 50°C. Если не починить за полчаса, внутри будет не выжить. Срочно нужен технарь.", "Cooling pipes have burst — the bunker is heating to 50°C. If not fixed in half an hour, inside becomes unlivable. We urgently need a technician."],
      disasters: ["heat"],
      tier: 3,
      highlight: ["ta'mirlash", "muhandislik", "elektrik", "tezda-harakat"],
      weak: ["foydasiz-ish", "tez-charchaydi", "sekin"],
      reason: ["ta'mirlash ishini bajara olmaydigan", "не справится с ремонтом", "can't handle the repair"],
    }),
    sit({
      text: ["Tunda tashqariga chiqib oziq-ovqat olib kelish kerak — 60°C dan 40°C ga tushgan tun yagona imkoniyat. Tezkor, sovuqqon, tungi ishga moslashgan kishi kerak. Sekin yoki qo'rqoq odam yo'lda halok bo'ladi.", "Ночью нужно выйти за едой — единственное окно, когда жара спадает с 60°C до 40°C. Подходит быстрый, хладнокровный, привычный к ночной работе. Медленный или трусливый погибнет в пути.", "Someone has to fetch food at night — the only window when the heat drops from 60°C to 40°C. We need someone fast, cool-headed, used to night work. The slow or cowardly will die on the way."],
      disasters: ["heat"],
      tier: 3,
      highlight: [
        "tezda-harakat",
        "tungi-ish",
        "jismoniy-kuch",
        "sovuqqonlik",
        "omon-qolish",
      ],
      weak: [
        "qo'rqoq",
        "issiqqa-chidamsiz",
        "sekin",
        "keksa",
        "tez-charchaydi",
      ],
      reason: ["tunda tashqarida ish qila olmaydigan", "не справится с работой ночью снаружи", "can't operate outside at night"],
    }),
    sit({
      text: ["Bunker quduqi butunlay qurib qoldi — suv faqat shahar quduqlarida. U yerga 3 kunlik xavfli yo'l. Faqat eng chidamli, suv topa oladigan kishi yetib boradi va qaytadi.", "Колодец бункера полностью пересох — вода осталась только в городских. До них — 3 дня опасного пути. Дойдёт и вернётся лишь самый выносливый, умеющий находить воду.", "The bunker's well has fully dried up — water is only in the city wells. A 3-day dangerous trip. Only the most durable, water-finding person will make it back."],
      disasters: ["heat"],
      tier: 4,
      highlight: [
        "chidamlilik",
        "suv-topish",
        "jismoniy-kuch",
        "omon-qolish",
        "issiqqa-chidamli",
      ],
      weak: [
        "ko'p-suv-ichadi",
        "issiqqa-chidamsiz",
        "qon-bosimi-yuqori",
        "yurak-kasalligi",
        "keksa",
      ],
      reason: ["uzoq issiq yo'lda yetib bormaydigan", "не дойдёт по долгой жаркой дороге", "won't survive the long hot trek"],
    }),
    sit({
      text: ["So'nggi sovutish bloki ishdan chiqdi — faqat eng kichik xona sovuq qoldi, 5 kishilik. Eng kam foydali yoki issiqqa eng chidamsiz kishi 60°C li xonada qoladi. Bu o'lim.", "Последний блок охлаждения отказал — холодной осталась только маленькая комната на пятерых. Наименее полезный или хуже всех переносящий жару останется в комнате 60°C. Это смерть.", "The last cooling block has failed — only the small 5-person room stays cold. The least useful or most heat-vulnerable stays in the 60°C room. It's death."],
      disasters: ["heat"],
      tier: 5,
      highlight: [
        "issiqqa-chidamli",
        "muhandislik",
        "tibbiyot",
        "suv-topish",
        "chidamlilik",
      ],
      weak: [
        "issiqqa-chidamsiz",
        "qon-bosimi-yuqori",
        "yurak-kasalligi",
        "keksa",
        "foydasiz-ish",
      ],
      reason: ["sovuq xonadan tashqarida omon qolmaydigan", "не выживет вне холодной комнаты", "won't survive outside the cold room"],
    }),

    sit({
      text: ["Bunker shamollatish quvurlari qizib qoldi. Ichkari salqin qilish uchun kimdir har soatda nasos bilan ishlashi kerak — jismonan og'ir ish.", "Вентиляционные трубы бункера раскалены. Чтобы охладить внутри, нужен человек на ручной насос каждый час — это физически тяжело.", "The bunker's vents have overheated. Cooling the inside means someone working the manual pump every hour — physically brutal."],
      disasters: ["heat"],
      tier: 1,
      highlight: ["jismoniy-kuch", "chidamlilik", "intizomli", "sog'lom"],
      weak: [
        "tez-charchaydi",
        "issiqqa-chidamsiz",
        "keksa",
        "foydasiz-ish",
        "dangasa",
      ],
      reason: ["nasos ishida charchab guruhga yuk bo'ladigan", "вымотается на насосе и станет обузой", "will burn out at the pump and become dead weight"],
    }),
    sit({
      text: ["Bunker namligi nol — havo qurib qoldi. Nafas olish qiyin, ko'z achiyapti. Yurak yoki astma muammosi bor odamlar birinchi yiqiladi.", "Влажности в бункере ноль — воздух высох. Дышать тяжело, глаза режет. Первыми падают сердечники и астматики.", "Humidity is zero inside — the air is bone dry. Hard to breathe, eyes burn. Heart or asthma patients drop first."],
      disasters: ["heat"],
      tier: 2,
      highlight: ["sog'lom", "immunitet-kuchli"],
      weak: [
        "astma",
        "yurak-kasalligi",
        "qon-bosimi-yuqori",
        "surunkali-kasallik",
        "keksa",
      ],
      reason: ["quruq havoda birinchi yiqilib qoladigan", "первым свалится от сухого воздуха", "first to fall to the dry air"],
    }),
    sit({
      text: ["Tashqaridan suv olib kelish kerak — tunda 30 km masofada quduq bor. Tez yuradigan, navigatsiya bila oladigan kishi qaytib keladi.", "Воду нужно принести снаружи — есть колодец в 30 км, идти ночью. Вернётся лишь быстрый, ориентирующийся.", "Water has to be brought from outside — a well 30 km away, traveled at night. Only the fast and navigation-savvy will return."],
      disasters: ["heat"],
      tier: 2,
      highlight: [
        "tez-yugurish",
        "navigatsiya",
        "jismoniy-kuch",
        "suv-topish",
        "chidamlilik",
      ],
      weak: [
        "keksa",
        "oyoq-jarohati",
        "ko'p-suv-ichadi",
        "sekin",
        "tez-charchaydi",
      ],
      reason: ["uzoq tungi yo'lda yetib bormaydigan", "не дойдёт по долгой ночной дороге", "won't make the long night trek"],
    }),
    sit({
      text: ["Bunker oziq-ovqati issiqdan tez buzilmoqda — saqlash uchun maxsus usul kerak. Muzlatmasdan saqlay oladigan kishi qadrli, foydasiz odam yo'q.", "Еда в бункере портится от жары — нужны специальные способы хранения. Ценится тот, кто умеет сохранять без холодильника. Бесполезному здесь нет места.", "Food in the bunker spoils fast in the heat — special preservation is needed. The one who can store without refrigeration is precious. The useless have no place."],
      disasters: ["heat"],
      tier: 3,
      highlight: ["dehqon", "ferma", "kimyo", "muqobil-saqlash"],
      weak: ["foydasiz-ish", "bloger", "ko'p-ovqat"],
      reason: ["ovqat saqlashda hech narsa berolmaydigan", "ничего не даёт по хранению еды", "contributes nothing to food preservation"],
    }),
    sit({
      text: ["Ozon qatlami yo'q bo'ldi — kunduzi quyosh tegsa, teri kuyadi. Yashash faqat tunda mumkin. Tungi ishga moslashgan kishi qadrli.", "Озоновый слой исчез — днём кожа сгорает от солнца. Жить можно только ночью. Ценится тот, кто работает ночью.", "The ozone layer is gone — skin burns under the sun by day. Life is possible only at night. Anyone used to night work is valued."],
      disasters: ["heat"],
      tier: 4,
      highlight: [
        "tungi-ish",
        "sovuqqonlik",
        "tezda-harakat",
        "omon-qolish",
        "chidamlilik",
      ],
      weak: ["qo'rqoq", "sekin", "keksa", "foydasiz-ish", "tez-charchaydi"],
      reason: ["tungi tartibga ko'nikolmaydigan", "не сможет жить ночным распорядком", "can't adapt to a nocturnal routine"],
    }),
    sit({
      text: ["Bunker oxirgi sovutish bloki tugadi — endi faqat eng issiqqa chidamli kishilar tirik qoladi. Boshqalar 50°C li xonada yiqilib qoladi.", "Последний охлаждающий блок выгорел — выживут только самые жароустойчивые. Остальные свалятся в комнате при 50°C.", "The final cooling unit has burned out — only the most heat-resistant will live. Others will collapse in the 50°C room."],
      disasters: ["heat"],
      tier: 5,
      highlight: [
        "issiqqa-chidamli",
        "chidamlilik",
        "sog'lom",
        "jismoniy-kuch",
        "yosh",
      ],
      weak: [
        "issiqqa-chidamsiz",
        "qon-bosimi-yuqori",
        "yurak-kasalligi",
        "keksa",
        "surunkali-kasallik",
      ],
      reason: ["sovutgichsiz issiqlikda omon qolmaydigan", "не выживет в жаре без охлаждения", "won't survive heat without cooling"],
    }),

    // ============================================================
    // ZOMBI APOKALIPSISI (zombie) — 6 situation
    // ============================================================
    sit({
      text: ["Bunker eshigida zombi yig'ila boshladi. Har soatda kimdir qurol bilan navbatchilik qilishi kerak. Qo'rqoq yoki sekin kishi birinchi smenada o'limini topadi.", "У двери бункера собираются зомби. Каждый час кто-то должен стоять на посту с оружием. Трус или медлительный погибнет на первой смене.", "Zombies are gathering at the bunker door. Every hour someone has to stand guard with a weapon. A coward or a slow person dies on the first shift."],
      disasters: ["zombie"],
      tier: 1,
      highlight: ["qurol", "jang", "sovuqqonlik", "jismoniy-kuch"],
      weak: ["qo'rqoq", "sekin", "tez-charchaydi", "oyoq-jarohati"],
      reason: ["zombi navbatchiligida tirik qaytmaydigan", "не вернётся живым с дежурства", "won't survive their watch shift"],
    }),
    sit({
      text: ["Oziq-ovqat olishga shahar omboriga chiqish kerak. Tez yugurish, qurol ushlash, shovqinsiz harakat — uchchovi bir vaqtda. Bittasi yetishmasa, qaytmaysan.", "За едой нужно идти на городской склад. Бежать быстро, держать оружие, двигаться тихо — всё сразу. Не хватит чего-то одного — не вернёшься.", "We need to raid the city warehouse for food. Run fast, hold a weapon, move silent — all at once. Miss any one, you don't come back."],
      disasters: ["zombie"],
      tier: 2,
      highlight: [
        "tez-yugurish",
        "qurol",
        "kuzatuv",
        "jismoniy-kuch",
        "sovuqqonlik",
      ],
      weak: ["sekin", "shovqinli", "oyoq-jarohati", "qo'rqoq", "keksa"],
      reason: ["shahar reydiga yaramaydigan", "не годится для рейда в город", "no good for a city raid"],
    }),
    sit({
      text: ["Bunker devorida zombi tirnoqlari darz qoldirdi — tezda ta'mirlash kerak. Quruvchi yoki jismoniy mehnatga qodir kishi. Kechgacha bajarilmasa, kechasi devor sinadi.", "Зомби когтями оставили трещину в стене бункера — починить нужно срочно. Подойдёт строитель или физически крепкий. Если до вечера не сделать, ночью стена обвалится.", "Zombie claws left a crack in the bunker wall — repair urgently. A builder or a physically strong person. If not done by evening, the wall breaks at night."],
      disasters: ["zombie"],
      tier: 3,
      highlight: ["ta'mirlash", "muhandislik", "jismoniy-kuch", "quruvchi"],
      weak: ["foydasiz-ish", "tez-charchaydi", "keksa", "oyoq-jarohati"],
      reason: ["devorni qura olmaydigan va guruhga jismoniy yordam bermaydigan", "не может ни строить, ни помогать физически", "can't build or pitch in physically"],
    }),
    sit({
      text: ["Tashqaridagi zombi to'plami katta — har bir shovqin to'plamni chaqiradi. Bunkerda intizomsiz, shovqinli yoki jahli tez kishi butun guruhni bir tunda fosh qiladi.", "Стая зомби снаружи большая — любой шум стягивает их к двери. Недисциплинированный, шумный или вспыльчивый сдаст всех за одну ночь.", "The zombie horde outside is huge — every noise draws it in. An undisciplined, loud, or hot-tempered person exposes everyone in a single night."],
      disasters: ["zombie"],
      tier: 3,
      highlight: ["intizomli", "sovuqqonlik", "sabr"],
      weak: ["shovqinli", "sabrsiz", "jahldor", "pranker", "hazilkash"],
      reason: ["shovqin bilan zombilarni chaqirib hammani xavfga qo'yadigan", "шумит и стягивает зомби к бункеру", "draws zombies in with their noise"],
    }),
    sit({
      text: ["Zombilar bunker eshigini sindirib kirdi. Jang vaqti! Qurol ushlay olmaydigan, jismonan zaif, sekin kishi fronlikda halok bo'ladi va boshqalarni ham xavfga tashlaydi.", "Зомби проломили дверь. Бой! Тот, кто не держит оружие, физически слаб или медлителен, погибнет в первой линии и подведёт остальных.", "Zombies have broken through the door. Combat time! Anyone who can't wield a weapon, is physically weak or slow will die on the front line and drag others down."],
      disasters: ["zombie"],
      tier: 4,
      highlight: [
        "qurol",
        "jang",
        "jismoniy-kuch",
        "sovuqqonlik",
        "tez-yugurish",
      ],
      weak: [
        "qo'rqoq",
        "sekin",
        "oyoq-jarohati",
        "tez-charchaydi",
        "keksa",
        "foydasiz-ish",
      ],
      reason: ["jangda guruhga yordam berolmaydigan va o'zini saqlay olmaydigan", "не сможет ни помочь в бою, ни сам уцелеть", "no help in the fight, can't even save themselves"],
    }),
    sit({
      text: ["Bunker xavfsiz emas — boshqa joyga ko'chish kerak. Uzoq, xavfli yo'l. Faqat kuchli, tezkor, qurolli va jamoaviy ish bila oladigan odamlar yetib boradi. Boshqa har kim yo'lda zombi yemi.", "В бункере небезопасно — нужно перебираться. Дорога долгая и опасная. Дойдут только сильные, быстрые, вооружённые и сработавшиеся командой. Остальные — корм зомби.", "The bunker isn't safe — we have to move. The road is long and deadly. Only the strong, fast, armed, and team-minded make it. The rest are zombie food."],
      disasters: ["zombie"],
      tier: 5,
      highlight: [
        "jismoniy-kuch",
        "tez-yugurish",
        "qurol",
        "jamoaviy-ish",
        "sovuqqonlik",
        "omon-qolish",
      ],
      weak: [
        "sekin",
        "qo'rqoq",
        "oyoq-jarohati",
        "keksa",
        "tez-charchaydi",
        "egoist",
        "foydasiz-ish",
      ],
      reason: ["yo'lda guruhga ergasha olmaydigan", "не угонится за группой по пути", "can't keep up with the group on the move"],
    }),

    sit({
      text: ["Bunker ichida birinchi shovqin chiqdi — kimdir nochalon yiqildi. Zombilar shovqin eshitib eshik yaqinida to'planmoqda. Intizomsiz kishi hammani fosh qildi.", "В бункере раздался первый шум — кто-то неловко упал. Зомби услышали и сходятся к двери. Недисциплинированный выдал всех.", "First noise inside the bunker — someone clumsy fell. Zombies heard it and are gathering at the door. An undisciplined person gave us all away."],
      disasters: ["zombie"],
      tier: 1,
      highlight: ["intizomli", "sovuqqonlik", "sabr"],
      weak: ["shovqinli", "jahldor", "pranker", "hazilkash", "sabrsiz"],
      reason: ["shovqin bilan zombilarni chaqirayotgan", "шумит и зовёт зомби", "makes the noise that calls zombies"],
    }),
    sit({
      text: ["Bunker eshigi old tomonida zombi to'plami yig'ila boshladi. Kimdir tashqariga chiqib ularni boshqa tarafga olib ketishi kerak — tez yugurish va jasur kishi.", "Перед дверью бункера собирается стая зомби. Кто-то должен выйти и увести их в другую сторону — быстрый и смелый.", "A zombie pack is forming outside the bunker door. Someone has to step out and lure them away — fast and brave."],
      disasters: ["zombie"],
      tier: 2,
      highlight: [
        "tez-yugurish",
        "jang",
        "sovuqqonlik",
        "omon-qolish",
        "jismoniy-kuch",
      ],
      weak: ["sekin", "qo'rqoq", "oyoq-jarohati", "keksa", "tez-charchaydi"],
      reason: ["zombilarni chalg'ita olmaydigan", "не сможет отвести зомби", "can't lure the zombies away"],
    }),
    sit({
      text: ["Bunker yaqinidagi do'kondan dori olish kerak — sog'liq kasallar uchun. Sovuqqon va tez ishlay oladigan kishi — yarim soat ichida kirish va qaytish.", "Из магазина рядом нужно принести лекарства — для больных. Подойдёт хладнокровный и быстрый: войти и вернуться за полчаса.", "Medicine has to be fetched from the nearby shop — for the sick. Someone cold-headed and fast: in and out in half an hour."],
      disasters: ["zombie"],
      tier: 2,
      highlight: [
        "tibbiyot",
        "tezda-harakat",
        "sovuqqonlik",
        "qurol",
        "tez-yugurish",
      ],
      weak: ["qo'rqoq", "sekin", "foydasiz-ish", "oyoq-jarohati"],
      reason: ["tez reydni bajara olmaydigan", "не справится с быстрым рейдом", "can't handle a quick raid"],
    }),
    sit({
      text: ["Kimdir tunda eshikni yashirin ochib chiqdi — zombi unga ergashdi. Bunker xavfda. Yashirin niyat yoki manipulyatsiya kuchli kishi shubha ostida.", "Кто-то ночью тайком открыл дверь — за ним пошёл зомби. Бункер в опасности. Под подозрением — скрытный или склонный к манипуляциям.", "Someone snuck the door open at night — a zombie followed. The bunker is at risk. Anyone with hidden motives or manipulative tendencies falls under suspicion."],
      disasters: ["zombie"],
      tier: 3,
      highlight: ["intizomli", "ishonchli", "jamoaviy-ish", "sovuqqonlik"],
      weak: [
        "manipulyator",
        "hiylakor",
        "egoist",
        "doim-yolg'on-gapiradi",
        "firibgar",
      ],
      reason: ["guruh xavfsizligini buzayotgan yashirin niyatga ega", "со скрытыми мотивами, ставящими группу под удар", "has hidden motives that threaten the group"],
    }),
    sit({
      text: ["Zombilar bunker shipiga chiqib oldi. Devordan tushib kira boshladi. Jang vaqti — qurol ushlay oladigan, jang qila oladigan kishi kerak.", "Зомби забрались на крышу бункера и спускаются по стене. Время боя — нужен тот, кто держит оружие и умеет драться.", "Zombies have climbed onto the bunker roof and are descending the walls. Combat now — we need someone who can hold a weapon and fight."],
      disasters: ["zombie"],
      tier: 4,
      highlight: [
        "jang",
        "qurol",
        "jismoniy-kuch",
        "sovuqqonlik",
        "tez-yugurish",
      ],
      weak: [
        "qo'rqoq",
        "sekin",
        "oyoq-jarohati",
        "tez-charchaydi",
        "keksa",
        "foydasiz-ish",
      ],
      reason: ["jangda guruhga yordam berolmaydigan", "не поможет в бою", "no help in combat"],
    }),
    sit({
      text: ["Bunker oxirgi nasos ham buzildi — ko'chish vaqti. Yangi joygacha ikki haftalik xavfli yo'l. Eng kuchli va eng tezkor odamlar yetib boradi.", "Последний насос в бункере сломался — пора уходить. До нового места — две недели опасного пути. Дойдут только самые сильные и быстрые.", "The bunker's last pump has broken — time to leave. Two weeks of dangerous travel to the new spot. Only the strongest and fastest make it."],
      disasters: ["zombie"],
      tier: 5,
      highlight: [
        "jismoniy-kuch",
        "jang",
        "qurol",
        "jamoaviy-ish",
        "omon-qolish",
        "chidamlilik",
      ],
      weak: [
        "sekin",
        "qo'rqoq",
        "oyoq-jarohati",
        "keksa",
        "egoist",
        "foydasiz-ish",
      ],
      reason: ["uzoq xavfli yo'lda yetib bormaydigan", "не выдержит долгого опасного пути", "won't survive the long dangerous trek"],
    }),

    // ============================================================
    // UNIVERSAL — 10 situation (har qanday falokatda chiqadi)
    // ============================================================
    sit({
      text: ["Bunker ovqati tor — har kuni faqat 1 mahal. Ko'p ovqat talab qiladigan, porsiyaga rozi bo'lmaydigan, jahli tez kishi guruh oziq-ovqatini tezroq tugatadi.", "Еды в бункере мало — только одно блюдо в день. Тот, кто много ест, не доволен порцией и быстро злится, прикончит запасы группы быстрее.", "Food in the bunker is tight — one meal a day. Heavy eaters, the unsatisfied, the quick-tempered burn through the group's supplies faster."],
      disasters: ["all"],
      tier: 1,
      highlight: ["chidamlilik", "intizomli", "sog'lom", "ovqat-zaxirasi"],
      weak: ["ko'p-ovqat", "egoist", "jahldor", "sabrsiz"],
      reason: ["ovqat masalasida intizomsiz va guruh resurslarini bekorga sarflaydigan", "без дисциплины с едой и впустую тратит запасы", "undisciplined with food and wastes group supplies"],
    }),
    sit({
      text: ["Bunker liderligi atrofida bahs ko'tarildi. Hozir aqlli, sovuqqon, jamoa fikrini eshita oladigan kishi kerak. Egoist yoki manipulyator lider bo'lsa, guruh ichidan parchalanadi.", "Разгорелся спор о лидерстве в бункере. Сейчас нужен умный, хладнокровный, умеющий слышать команду. Если лидером станет эгоист или манипулятор, группа развалится изнутри.", "A leadership dispute has flared up in the bunker. We need someone smart, cool-headed, who listens to the group. If a selfish or manipulative person leads, the group falls apart from inside."],
      disasters: ["all"],
      tier: 1,
      highlight: ["lider", "sovuqqonlik", "jamoaviy-ish", "aql", "ishonchli"],
      weak: [
        "egoist",
        "manipulyator",
        "jahldor",
        "qo'rqoq",
        "doim-yolg'on-gapiradi",
      ],
      reason: ["liderlik o'rnini olishga loyiq emas va guruhni buzadigan", "не достоин лидерства и разрушает группу", "unfit to lead and splits the group"],
    }),
    sit({
      text: ["Suv filtri buzildi — ichimlik suvi 3 kunga yetadi. Texnik kishi yoki muqobil suv topa oladigan odam bunkerni saqlaydi. Foydasiz kasb bu vaziyatda hech qanday yordam bermaydi.", "Фильтр воды сломан — питьевой воды на 3 дня. Спасёт бункер технарь или тот, кто найдёт альтернативу. Бесполезная профессия здесь ничего не даст.", "The water filter has broken — drinking water lasts 3 days. The bunker is saved by a technician or by someone who finds another source. A useless profession contributes nothing here."],
      disasters: ["all"],
      tier: 2,
      highlight: [
        "ta'mirlash",
        "muhandislik",
        "suv-topish",
        "kimyo",
        "elektrik",
      ],
      weak: ["foydasiz-ish", "ko'p-suv-ichadi", "bloger"],
      reason: ["suv muammosini hal qila olmaydigan", "не решит проблему с водой", "can't solve the water problem"],
    }),
    sit({
      text: ["Bunkerda resurs (dori, ovqat, asbob) yo'qoldi. O'g'ri ichkarida. Yolg'on gapirish odat bo'lgan, firibgar yoki qarzdor kishi shubhada.", "В бункере пропали припасы (лекарства, еда, инструменты). Вор внутри. Под подозрением — лжец, мошенник или должник.", "Supplies (medicine, food, tools) have gone missing inside the bunker. The thief is among us. Habitual liars, con artists, and debtors are suspect."],
      disasters: ["all"],
      tier: 2,
      highlight: ["ishonchli", "mehribon", "intizomli", "jamoaviy-ish"],
      weak: [
        "doim-yolg'on-gapiradi",
        "firibgar",
        "manipulyator",
        "hiylakor",
        "qarzdor",
        "yashirin-boy",
      ],
      reason: ["ishonchsiz va resurs o'g'irlagan bo'lishi mumkin", "ненадёжен и мог украсть припасы", "unreliable and could be the one stealing"],
    }),
    sit({
      text: ["Tashqaridan begona keldi — yordam so'rayapti. Joy bermaslik vijdon yuki, joy berish — yangi xavf. Yangi odam yaxshiroq sifatlarga ega, bizdagi eng kam foydali kishi joyini berishi kerak.", "Снаружи пришёл чужак — просит помощи. Отказать — груз на совести, впустить — новая опасность. Новый человек полезнее, и наименее ценный из нас должен уступить ему место.", "A stranger arrived from outside — asking for help. Refusing them weighs on our conscience; letting them in is a new risk. The newcomer is more useful, and the least valuable of us must give up their spot."],
      disasters: ["all"],
      tier: 3,
      highlight: [
        "muhandislik",
        "tibbiyot",
        "ovchilik",
        "jismoniy-kuch",
        "ishonchli",
      ],
      weak: [
        "foydasiz-ish",
        "doim-yolg'on-gapiradi",
        "manipulyator",
        "qarzdor",
        "bloger",
      ],
      reason: ["begona kishi o'rniga eng kam foydali", "менее полезен, чем чужак", "less useful than the newcomer"],
    }),
    sit({
      text: ["Bunkerda kimdir ovqatni yashirin yig'ayotgani aniqlandi — xudbinlik guruhga zarar. Ishonch tiklanmaydi. Egoist va manipulyator kishilar bu xilda harakat qiladi.", "Выяснилось, что кто-то в бункере тайно копит еду — эгоизм бьёт по группе. Доверие не вернуть. Так ведут себя эгоисты и манипуляторы.", "Someone has been secretly hoarding food — selfishness harming the group. Trust won't be restored. Selfish and manipulative people behave like this."],
      disasters: ["all"],
      tier: 3,
      highlight: ["jamoaviy-ish", "intizomli", "mehribon", "ishonchli"],
      weak: ["egoist", "manipulyator", "hiylakor", "yashirin-boy", "firibgar", "yashirin-fakt"],
      reason: ["guruh ichida ishonch buzgan va xudbin", "подорвал доверие группы и думает лишь о себе", "broke the group's trust and looks out only for themselves"],
    }),
    sit({
      text: ["Generator buzildi — 24 soat ichida tuzatilmasa, chiroq, isitma, sovutish hammasi yo'qoladi. Texnik kishi shart. Foydasiz kasb bu rolni bajara olmaydi.", "Генератор сломался — если не починить за сутки, не будет ни света, ни тепла, ни охлаждения. Без технаря никак. Бесполезная профессия не вытянет.", "The generator has failed — if it's not fixed within 24 hours, lights, heat, and cooling all die. A technician is essential. A useless profession can't pull this off."],
      disasters: ["all"],
      tier: 3,
      highlight: ["muhandislik", "ta'mirlash", "elektrik", "texnika"],
      weak: ["foydasiz-ish", "bloger", "dangasa"],
      reason: ["texnik muammoda hech narsa berolmaydigan", "бесполезен в технической проблеме", "no help with technical problems"],
    }),
    sit({
      text: ["So'nggi dori dozasi — 1 kishiga yetadi. Tibbiy yordamga muhtoj surunkali kasalliklilar uchun bu o'lim hukmi. Davo bera olmagan kishini saqlash — boshqalarni nobud qilish.", "Последняя доза лекарства — на одного. Для хроников, нуждающихся в лечении, это приговор. Оставить того, кому нечем помочь, — погубить остальных.", "The last dose of medicine — enough for one. For the chronically ill, this is a death sentence. Keeping someone we can't treat means killing the rest."],
      disasters: ["all"],
      tier: 4,
      highlight: ["sog'lom", "tibbiyot"],
      weak: [
        "surunkali-kasallik",
        "diabet",
        "yurak-kasalligi",
        "doimiy-og'riq",
        "tibbiy-yordamga-muhtoj",
        "keksa",
      ],
      reason: ["doriga muhtoj va bermaganda yashay olmaydigan", "нуждается в лекарствах и не выживет без них", "needs medication and won't survive without it"],
    }),
    sit({
      text: ["Bunker ruhiyati buzilib bormoqda. Kimdir sinib, agressiv bo'lib bormoqda — jahli tez, sabrsiz, pessimist odam. Boshqalarga zarar yetkazmasdan oldin chetlatish kerak.", "Настроение в бункере падает. Кто-то ломается и становится агрессивным — вспыльчивый, нетерпеливый, пессимист. Лучше убрать его, пока он не навредил остальным.", "Morale inside the bunker is breaking down. Someone is cracking — hot-tempered, impatient, pessimistic. Better remove them before they hurt others."],
      disasters: ["all"],
      tier: 4,
      highlight: [
        "sovuqqonlik",
        "intizomli",
        "optimist",
        "ishonchli",
        "mehribon",
      ],
      weak: ["jahldor", "sabrsiz", "pessimist", "manipulyator", "egoist"],
      reason: ["ruhiy holati guruhga xavf solib agressiv bo'lib bormoqda", "психически нестабилен и становится опасным", "mentally unstable and becoming dangerous"],
    }),
    sit({
      text: ["Bunker chiqish vaqti yaqin — yangi dunyoda hayot boshlanadi. Yangi dunyoga foyda bermaydigan, kelajakka hissa qo'sha olmaydigan, yashash imkoniyati past kishi qolmaydi.", "Скоро выход из бункера — начнётся жизнь в новом мире. Тот, кто не принесёт пользу новому миру и не сможет внести вклад в будущее, не останется.", "Bunker exit time is near — life begins in the new world. Whoever can't contribute to the new world or the future won't stay."],
      disasters: ["all"],
      tier: 5,
      highlight: [
        "yosh",
        "sog'lom",
        "aql",
        "muhandislik",
        "tibbiyot",
        "ovchilik",
        "ferma",
      ],
      weak: [
        "keksa",
        "surunkali-kasallik",
        "foydasiz-ish",
        "tibbiy-yordamga-muhtoj",
        "bloger",
      ],
      reason: ["yangi dunyoga eng kam hissa qo'sha oladigan", "принесёт меньше всего пользы в новом мире", "contributes the least to the new world"],
    }),

    sit({
      text: ["Bunker tunlari uzun va ruhiyat tushib bormoqda. Optimist va guruhni ko'tara oladigan kishi qadrli. Pessimist hammani ruhsizlantiradi.", "Ночи в бункере длинные, настроение падает. Ценится оптимист, способный поднять группу. Пессимист тянет всех вниз.", "Nights in the bunker drag on and morale sinks. The optimist who lifts the group is valued. A pessimist drags everyone down."],
      disasters: ["all"],
      tier: 1,
      highlight: ["optimist", "hazilkash", "mehribon", "jamoaviy-ish", "lider"],
      weak: ["pessimist", "jahldor", "egoist", "manipulyator"],
      reason: ["guruh ruhiyatini buzayotgan", "разрушает дух группы", "tears down the group's morale"],
    }),
    sit({
      text: ["Bunker ichidagi havo bug'li — kimdir doimiy tozalashi kerak. Foydasiz va dangasa kishi bu ishni qilmaydi, lekin ovqat oladi.", "В бункере спёртый воздух — кто-то должен постоянно его проветривать. Бесполезный и ленивый этого не сделает, но порцию заберёт.", "Bunker air is heavy — someone has to keep it fresh. The useless and lazy won't do it, but they'll still take their share."],
      disasters: ["all"],
      tier: 1,
      highlight: ["intizomli", "jismoniy-kuch", "mehribon", "jamoaviy-ish"],
      weak: ["dangasa", "foydasiz-ish", "egoist", "bloger"],
      reason: ["guruh ishida qatnashmaydigan", "не участвует в общей работе", "doesn't pull weight in shared work"],
    }),
    sit({
      text: ["Bunker eshigida begona ovoz — kimdir ichkariga kirishni so'rayapti. Aniqlay olmayapmiz: yordam kerakmi yoki firibgar. Sovuqqon, sezgir kishi qaror qilishi kerak.", "У двери бункера чужой голос — кто-то просится внутрь. Непонятно: ему нужна помощь или это мошенник. Решать должен хладнокровный и внимательный.", "A stranger's voice at the bunker door — asking to come in. We can't tell if they need help or are a con. The cold-headed and observant should decide."],
      disasters: ["all"],
      tier: 2,
      highlight: ["sovuqqonlik", "aql", "ishonchli", "kuzatuv", "lider"],
      weak: ["qo'rqoq", "manipulyator", "sabrsiz", "doim-yolg'on-gapiradi"],
      reason: ["muhim qarorda noto'g'ri yo'l tutadigan", "ошибётся в важном решении", "would make the wrong call in a critical decision"],
    }),
    sit({
      text: ["Bunker ovqat zaxirasidan ko'p miqdorda ovqat yo'qoldi — yashirin yeyilgan. Guruhda egoist yoki manipulyator kishi zarar yetkazyapti.", "Из запасов бункера тайно съедена большая часть еды. В группе действует эгоист или манипулятор.", "A big chunk of the bunker's food stash has secretly been eaten. A selfish or manipulative person is hurting the group."],
      disasters: ["all"],
      tier: 2,
      highlight: ["ishonchli", "jamoaviy-ish", "mehribon", "intizomli"],
      weak: ["egoist", "manipulyator", "hiylakor", "yashirin-boy", "firibgar"],
      reason: ["guruh resurslarini yashirin o'g'irlayotgan bo'lishi mumkin", "мог тайно красть припасы группы", "could be the one secretly stealing group supplies"],
    }),
    sit({
      text: ["Bunker ichida ikki kishi orasida nizo kuchaydi — jamoa bo'linib bormoqda. Sovuqqon kishi vositachilik qila oladi, jahldor kishi olovni avj oldiradi.", "Между двумя в бункере разгорелся конфликт — команда раскалывается. Хладнокровный сможет помирить, вспыльчивый — раздует пожар.", "A feud has flared up between two people in the bunker — the team is splitting. The cool-headed can mediate; the hot-tempered fans the flames."],
      disasters: ["all"],
      tier: 3,
      highlight: ["sovuqqonlik", "lider", "jamoaviy-ish", "mehribon", "aql"],
      weak: ["jahldor", "sabrsiz", "egoist", "manipulyator"],
      reason: ["nizoni olovlantirib guruhni parchalayotgan", "раздувает конфликт и разваливает группу", "fuels the conflict and tears the group apart"],
    }),
    sit({
      text: ["Bunker eshigida sirli kishi — yordam so'rayapti, lekin yolg'on gapirayotgani aniq. Bizdagi yolg'onchilar uchun ham xuddi shu savol — kim haqiqatda foydali?", "У двери бункера странный человек — просит помощи, но врёт. И в самом бункере тот же вопрос к лжецам — кто из них реально полезен?", "A suspicious person at the bunker door — asking for help but clearly lying. The same question hangs over our own liars — who is actually useful?"],
      disasters: ["all"],
      tier: 3,
      highlight: ["ishonchli", "intizomli", "sovuqqonlik"],
      weak: [
        "doim-yolg'on-gapiradi",
        "firibgar",
        "manipulyator",
        "hiylakor",
        "qarzdor",
      ],
      reason: ["yolg'on gapirib guruh ishonchini buzayotgan", "ложью подрывает доверие группы", "undermines group trust with lies"],
    }),
    sit({
      text: ["Bunker tartibga bo'ysunmaydigan kishi paydo bo'ldi — ovqat porsiyasidan ko'p oladi, navbatchilik qilmaydi, intizomni buzadi. U guruh uchun yuk.", "В бункере появился тот, кто не подчиняется правилам — берёт еды больше нормы, не дежурит, нарушает порядок. Он — обуза.", "Someone in the bunker refuses to follow the rules — takes more food, skips guard shifts, breaks discipline. They're a burden."],
      disasters: ["all"],
      tier: 3,
      highlight: ["intizomli", "jamoaviy-ish", "mehribon", "ishonchli"],
      weak: ["dangasa", "egoist", "sabrsiz", "jahldor", "foydasiz-ish"],
      reason: ["tartibni buzib guruhga yuk bo'layotgan", "нарушает порядок и тянет группу вниз", "breaks the rules and weighs the group down"],
    }),
    sit({
      text: ["Bunker ichida ruhiy buzilish boshlandi — kimdir sinib, agressiv bo'lib bormoqda. Boshqalarga zarar yetkazmasdan oldin chetlatish kerak.", "В бункере началось психическое расстройство — кто-то ломается и становится агрессивным. Лучше убрать его до того, как он навредит остальным.", "A mental breakdown is starting inside the bunker — someone is cracking and turning aggressive. Better remove them before they harm others."],
      disasters: ["all"],
      tier: 4,
      highlight: [
        "sovuqqonlik",
        "optimist",
        "ishonchli",
        "mehribon",
        "jamoaviy-ish",
      ],
      weak: ["jahldor", "sabrsiz", "pessimist", "manipulyator", "egoist"],
      reason: ["ruhiy holati guruhga xavf solib agressiv bo'lib bormoqda", "психически нестабилен и становится опасным", "mentally unstable and becoming dangerous"],
    }),
    sit({
      text: ["Bunker eshigi qayta yopilmasligi mumkin — kimdir ichkariga kelganida buzilgan. Tezda ta'mirlash kerak, aks holda 1 soatda hamma xavf ostida.", "Дверь бункера, возможно, больше не закроется — её сломали, когда кто-то входил. Чинить срочно, иначе через час все под угрозой.", "The bunker door may no longer close — it broke when someone came in. Fix it fast, or in an hour everyone is in danger."],
      disasters: ["all"],
      tier: 4,
      highlight: [
        "ta'mirlash",
        "muhandislik",
        "jismoniy-kuch",
        "tezda-harakat",
        "elektrik",
      ],
      weak: ["foydasiz-ish", "tez-charchaydi", "sekin", "dangasa"],
      reason: ["shoshilinch ta'mirlash ishini bajara olmaydigan", "не справится со срочным ремонтом", "can't handle the urgent repair"],
    }),
    sit({
      text: ["Yangi dunyo — yangi insoniyat. Bunkerdan chiqishdan oldin oxirgi tanlov: kim hayot davom etishini boshlay oladi, kim faqat resurs sarflaydi?", "Новый мир — новое человечество. Перед выходом из бункера последний выбор: кто начнёт жизнь заново, а кто лишь потратит ресурсы?", "A new world — a new humanity. Before leaving the bunker, the final choice: who will start life over, and who will only burn resources?"],
      disasters: ["all"],
      tier: 5,
      highlight: [
        "yosh",
        "sog'lom",
        "aql",
        "jamoaviy-ish",
        "muhandislik",
        "tibbiyot",
        "ovchilik",
        "ko'paytirish-qobiliyati",
      ],
      weak: [
        "keksa",
        "surunkali-kasallik",
        "foydasiz-ish",
        "tibbiy-yordamga-muhtoj",
        "ko'paytirish-imkoni-yo'q",
      ],
      reason: ["yangi avlodga eng kam imkoniyat bera oladigan", "даст меньше всего нового поколению", "offers the least to the next generation"],
    }),
  ],
};
