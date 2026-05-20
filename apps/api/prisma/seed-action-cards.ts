import { BunkerActionEffect, BunkerActionTargetScope } from "@prisma/client";

export type SeedActionCard = {
  key: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  descriptionUz: string;
  descriptionRu: string;
  descriptionEn: string;
  effect: BunkerActionEffect;
  targetScope: BunkerActionTargetScope;
  tier: number;
  isAdult?: boolean;
  // V2/V3 effektlar hali implement qilinmagan. Faza 4-6 davomida bittadan
  // yoqamiz; shu vaqtgacha tarqatishga kirmasin.
  enabled: boolean;
};

export const seedActionCards: SeedActionCard[] = [
  // ============================================================
  // V1 — sodda, faqat o'ziga ta'sir (Faza 4 da yoqiladi)
  // ============================================================
  {
    key: "immunity_round",
    titleUz: "Daxlsizlik",
    titleRu: "Иммунитет",
    titleEn: "Immunity",
    descriptionUz:
      "Bu raundda sizga qarshi berilgan barcha ovozlar bekor qilinadi. Sizni haydash mumkin emas.",
    descriptionRu:
      "В этом раунде все голоса против вас аннулируются. Вас нельзя исключить.",
    descriptionEn:
      "All votes against you this round are nullified. You cannot be eliminated.",
    effect: "IMMUNITY_THIS_ROUND",
    targetScope: "SELF",
    tier: 2,
    enabled: true,
  },
  {
    key: "double_vote",
    titleUz: "Nufuzli shaxs",
    titleRu: "Влиятельная персона",
    titleEn: "Influential figure",
    descriptionUz:
      "Bu raundda sizning ovozingiz 2 ta ovoz deb hisoblanadi.",
    descriptionRu:
      "В этом раунде ваш голос считается за два.",
    descriptionEn:
      "Your vote counts as two this round.",
    effect: "DOUBLE_VOTE_THIS_ROUND",
    targetScope: "SELF",
    tier: 2,
    enabled: true,
  },
  {
    key: "extra_baggage",
    titleUz: "Yashirin ombor",
    titleRu: "Тайный склад",
    titleEn: "Hidden stash",
    descriptionUz:
      "Kolodadan qo'shimcha bitta 'Bagaj' kartasini oling. Eski bagajingiz ham qoladi.",
    descriptionRu:
      "Возьмите дополнительную карту 'Багаж' из колоды. Ваш прежний багаж сохраняется.",
    descriptionEn:
      "Draw an extra Baggage card from the deck. Your existing baggage stays.",
    effect: "EXTRA_BAGGAGE",
    targetScope: "SELF",
    tier: 1,
    enabled: true,
  },
  {
    key: "skip_round",
    titleUz: "Panaga olinish",
    titleRu: "Укрытие",
    titleEn: "Take shelter",
    descriptionUz:
      "Bu raunddagi muhokamada qatnashmaysiz va ovoz bermaysiz. Lekin sizga ham hech kim ovoz bera olmaydi.",
    descriptionRu:
      "Вы не участвуете в обсуждении этого раунда и не голосуете. Но и за вас никто проголосовать не может.",
    descriptionEn:
      "You sit out this round's discussion and voting. But no one can vote against you either.",
    effect: "SKIP_THIS_ROUND",
    targetScope: "SELF",
    tier: 1,
    enabled: true,
  },
  {
    key: "heal_self",
    titleUz: "Mo'jizaviy shifo",
    titleRu: "Чудесное исцеление",
    titleEn: "Miraculous healing",
    descriptionUz:
      "O'zingizning 'Sog'liq' kartangizni bekor qilib, kolodadan yangisini torting.",
    descriptionRu:
      "Замените свою карту 'Здоровье' новой из колоды.",
    descriptionEn:
      "Discard your Health card and draw a new one from the deck.",
    effect: "REPLACE_OWN_HEALTH",
    targetScope: "SELF",
    tier: 1,
    enabled: true,
  },
  {
    key: "mutate_self",
    titleUz: "Genetik mutatsiya",
    titleRu: "Генетическая мутация",
    titleEn: "Genetic mutation",
    descriptionUz:
      "O'zingizning 'Biologiya' kartangizni yangisiga almashtiring.",
    descriptionRu:
      "Замените свою карту 'Биология' новой.",
    descriptionEn:
      "Replace your Biology card with a new one.",
    effect: "REPLACE_OWN_BIOLOGY",
    targetScope: "SELF",
    tier: 1,
    enabled: true,
  },

  // ============================================================
  // V2 — boshqa o'yinchiga ta'sir (Faza 5 da yoqiladi)
  // ============================================================
  {
    key: "heal_other",
    titleUz: "Tibbiy yordam",
    titleRu: "Медицинская помощь",
    titleEn: "Medical aid",
    descriptionUz:
      "Istalgan o'yinchining 'Sog'liq' kartasini bekor qilib, kolodadan yangisini torting.",
    descriptionRu:
      "Замените карту 'Здоровье' любого игрока новой из колоды.",
    descriptionEn:
      "Replace any player's Health card with a new one from the deck.",
    effect: "REPLACE_OTHER_HEALTH",
    targetScope: "ANY",
    tier: 2,
    enabled: true,
  },
  {
    key: "psychoanalysis",
    titleUz: "Psixoanaliz",
    titleRu: "Психоанализ",
    titleEn: "Psychoanalysis",
    descriptionUz:
      "Tanlangan o'yinchining 'Fakt' kartasini yopib, yangisiga almashtiring.",
    descriptionRu:
      "Закройте карту 'Факт' выбранного игрока и замените новой.",
    descriptionEn:
      "Discard the chosen player's Fact card and replace it with a new one.",
    effect: "REPLACE_OTHER_FACT",
    targetScope: "OTHER",
    tier: 2,
    enabled: true,
  },
  {
    key: "hr_mistake",
    titleUz: "Kadrlar bo'limi xatosi",
    titleRu: "Ошибка отдела кадров",
    titleEn: "HR mistake",
    descriptionUz:
      "Istalgan o'yinchining 'Kasb' kartasini yangisi bilan almashtiring. Eng kuchli kasb birdaniga foydasiz bo'lib qolishi mumkin.",
    descriptionRu:
      "Замените карту 'Профессия' любого игрока новой. Лучшая профессия может превратиться в бесполезную.",
    descriptionEn:
      "Replace any player's Profession card with a new one. The strongest profession may become useless.",
    effect: "REPLACE_OTHER_PROFESSION",
    targetScope: "ANY",
    tier: 3,
    enabled: true,
  },
  {
    key: "marauder",
    titleUz: "Marodyor",
    titleRu: "Мародёр",
    titleEn: "Marauder",
    descriptionUz:
      "Boshqa o'yinchining ochilgan 'Bagaj' kartasini o'zingizga olib qo'ying. U bagajsiz qoladi.",
    descriptionRu:
      "Заберите открытую карту 'Багаж' другого игрока себе. Он остаётся без багажа.",
    descriptionEn:
      "Take another player's revealed Baggage card. They are left without baggage.",
    effect: "STEAL_BAGGAGE",
    targetScope: "OTHER",
    tier: 3,
    enabled: false,
  },
  {
    key: "blackmail",
    titleUz: "Shantaj",
    titleRu: "Шантаж",
    titleEn: "Blackmail",
    descriptionUz:
      "Boshqa o'yinchining yopiq kartalaridan birini (siz tanlaysiz) hoziroq barchaga ochib ko'rsatishga majburlang.",
    descriptionRu:
      "Заставьте другого игрока немедленно открыть одну из его закрытых карт (вы выбираете какую).",
    descriptionEn:
      "Force another player to immediately reveal one of their hidden cards (you choose which).",
    effect: "REVEAL_HIDDEN_CARD",
    targetScope: "OTHER",
    tier: 2,
    enabled: true,
  },
  {
    key: "silence",
    titleUz: "Amneziya",
    titleRu: "Амнезия",
    titleEn: "Amnesia",
    descriptionUz:
      "Boshqa o'yinchini bu raundda jim qiling: u muhokamada gapira olmaydi.",
    descriptionRu:
      "Заставьте другого игрока молчать в этом раунде: он не может говорить в обсуждении.",
    descriptionEn:
      "Silence another player this round: they cannot speak in discussion.",
    effect: "SILENCE_PLAYER",
    targetScope: "OTHER",
    tier: 2,
    enabled: true,
  },
  {
    key: "smear_campaign",
    titleUz: "Qora PR (Tuhmat)",
    titleRu: "Чёрный пиар (клевета)",
    titleEn: "Smear campaign",
    descriptionUz:
      "Tanlangan o'yinchiga ovoz berish boshlanishidan oldin avtomatik 2 ta 'qarshi' ovoz yoziladi.",
    descriptionRu:
      "Выбранному игроку до начала голосования автоматически записываются 2 голоса 'против'.",
    descriptionEn:
      "Two 'against' votes are auto-cast on the chosen player before voting begins.",
    effect: "EXTRA_VOTES_AGAINST",
    targetScope: "OTHER",
    tier: 3,
    enabled: true,
  },

  // ============================================================
  // V3 — kuchli, voting/state o'zgartiruvchi (Faza 6 da yoqiladi)
  // ============================================================
  {
    key: "mirror_shield",
    titleUz: "Oynali himoya",
    titleRu: "Зеркальный щит",
    titleEn: "Mirror shield",
    descriptionUz:
      "Sizga berilgan barcha 'qarshi' ovozlarni o'zingiz tanlagan boshqa bir o'yinchiga yo'naltiring.",
    descriptionRu:
      "Перенаправьте все голоса 'против' с себя на выбранного игрока.",
    descriptionEn:
      "Redirect all 'against' votes targeted at you to another player of your choice.",
    effect: "REDIRECT_VOTES",
    targetScope: "OTHER",
    tier: 3,
    enabled: false,
  },
  {
    key: "instant_exile",
    titleUz: "Radikal qaror",
    titleRu: "Радикальное решение",
    titleEn: "Radical decision",
    descriptionUz:
      "Ovoz berishni kutmasdan, o'zingiz tanlagan o'yinchini bunkerdan darhol haydab yuboring. O'yindagi eng shafqatsiz karta.",
    descriptionRu:
      "Не дожидаясь голосования, немедленно изгоните выбранного игрока из бункера. Самая жестокая карта.",
    descriptionEn:
      "Without waiting for the vote, instantly exile a player of your choice from the bunker. The cruelest card.",
    effect: "INSTANT_EXILE",
    targetScope: "OTHER",
    tier: 3,
    enabled: false,
  },
  {
    key: "political_crisis",
    titleUz: "Siyosiy inqiroz",
    titleRu: "Политический кризис",
    titleEn: "Political crisis",
    descriptionUz:
      "Bu raundda hech kim ovoz bera olmaydi. Barcha muhokamalar to'xtatilib, hech kim bunkerdan haydalmaydi.",
    descriptionRu:
      "В этом раунде никто не голосует. Обсуждение прерывается, никого не исключают.",
    descriptionEn:
      "No one votes this round. All discussion stops, no one is exiled.",
    effect: "CANCEL_ROUND_VOTES",
    targetScope: "ALL",
    tier: 3,
    enabled: false,
  },
  {
    key: "revival",
    titleUz: "Qayta tug'ilish",
    titleRu: "Возрождение",
    titleEn: "Revival",
    descriptionUz:
      "Agar siz o'yindan chiqib ketishga yetarli ovoz to'plagan bo'lsangiz, shu kartani ishlatib o'yinda qolishingiz mumkin. Lekin barcha ochilgan kartalaringiz (Kasbdan tashqari) bekor qilinadi.",
    descriptionRu:
      "Если против вас набрано достаточно голосов для исключения, эта карта позволяет остаться. Но все ваши открытые карты (кроме Профессии) аннулируются.",
    descriptionEn:
      "If you have enough votes against you to be exiled, this card lets you stay. But all your revealed cards (except Profession) are nullified.",
    effect: "REVIVE_SELF",
    targetScope: "SELF",
    tier: 3,
    enabled: false,
  },
  {
    key: "full_disclosure",
    titleUz: "To'liq oshkoralik",
    titleRu: "Полное раскрытие",
    titleEn: "Full disclosure",
    descriptionUz:
      "O'zingizning hamma yopiq kartalaringizni darhol oching. Tartibsizlik tug'diradi va ko'pincha bahsda foydali bo'ladi.",
    descriptionRu:
      "Откройте все свои закрытые карты немедленно. Создаёт суматоху и часто выгодно в споре.",
    descriptionEn:
      "Immediately reveal all your hidden cards. Causes chaos and is often useful in debate.",
    effect: "FORCE_REVEAL_ALL_OWN",
    targetScope: "SELF",
    tier: 2,
    enabled: false,
  },
  {
    key: "reroll_card",
    titleUz: "Adolatsiz almashinuv",
    titleRu: "Несправедливый обмен",
    titleEn: "Unfair exchange",
    descriptionUz:
      "Tanlangan o'yinchining tanlangan kartasini majburan kolodadan yangi tasodifiy kartaga almashtirib qo'ying.",
    descriptionRu:
      "Принудительно замените выбранную карту выбранного игрока новой случайной из колоды.",
    descriptionEn:
      "Forcibly replace a chosen player's chosen card with a random new one from the deck.",
    effect: "REROLL_TARGET_CARD",
    targetScope: "ANY",
    tier: 3,
    enabled: false,
  },
  {
    key: "swap_curse",
    titleUz: "La'natni o'tkazish",
    titleRu: "Передать проклятие",
    titleEn: "Pass the curse",
    descriptionUz:
      "O'zingizning yomon kartangizni (masalan, og'ir kasalligingizni) boshqa o'yinchining yaxshi kartasi bilan almashtirib oling.",
    descriptionRu:
      "Обменяйте свою плохую карту (например, тяжёлую болезнь) на хорошую карту другого игрока.",
    descriptionEn:
      "Swap your bad card (e.g. a severe illness) with another player's good card.",
    effect: "STEAL_GOOD_GIVE_BAD",
    targetScope: "OTHER",
    tier: 3,
    enabled: false,
  },
];
