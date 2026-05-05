import { BunkerDifficulty } from "@prisma/client";

export type SeedLocalizedText = {
  uz: string;
  ru: string;
  en: string;
};

export type SeedContent = {
  cards: Record<string, Array<SeedLocalizedText & { isAdult?: boolean }>>;
  disasters: Array<{
    name: SeedLocalizedText;
    description: SeedLocalizedText;
    isAdult?: boolean;
  }>;
  situations: Array<{
    text: SeedLocalizedText;
    difficulty?: BunkerDifficulty;
    isAdult?: boolean;
  }>;
};

function text(uz: string, ru: string, en: string): SeedLocalizedText {
  return { uz, ru, en };
}

function adult(
  uz: string,
  ru: string,
  en: string,
): SeedLocalizedText & { isAdult: true } {
  return { uz, ru, en, isAdult: true };
}

export const seedContent: SeedContent = {
  cards: {
    kasb: [
      text("Elektrik", "Электрик", "Electrician"),
      text("Shifokor", "Врач", "Doctor"),
      text("Dehqon", "Фермер", "Farmer"),
      text("Mexanik", "Механик", "Mechanic"),
      text("Oshpaz", "Повар", "Cook"),
      text("Harbiy", "Военный", "Military"),
      text("Quruvchi", "Строитель", "Builder"),
      text("Haydovchi", "Водитель", "Driver"),
      text("O'qituvchi", "Учитель", "Teacher"),
      text("Sotuvchi", "Продавец", "Salesperson"),
      text("Bloger", "Блогер", "Blogger"),
      text("Huquqshunos", "Юрист", "Lawyer"),
      text("Sportchi", "Спортсмен", "Athlete"),
      text("Ferma ishchisi", "Работник фермы", "Farm worker"),
      text("Sartarosh", "Парикмахер", "Barber"),
      text("Kimyogar", "Химик", "Chemist"),

      // 18+
      adult("Seks ishchisi", "Секс-работник", "Sex worker"),
      adult("Pornofilm rejissyori", "Режиссёр порно", "Porn director"),
      adult("Striptiz raqschi", "Стриптизёр", "Stripper"),
      adult("Kazino dilleri", "Казино-дилер", "Casino dealer"),
      adult(
        "Qonuniy giyohvand sotuvchi",
        "Легальный наркодилер",
        "Legal drug dealer",
      ),
      adult("Qurol savdogari", "Торговец оружием", "Arms dealer"),
      adult("Kriptovalyuta sxemachisi", "Крипто-мошенник", "Crypto scammer"),
      adult("Jasadlarni yuvuvchi", "Обмыватель трупов", "Body washer"),
      adult("OnlyFans modeli", "Модель OnlyFans", "OnlyFans model"),
      adult("Tungi klub xodimi", "Работник ночного клуба", "Night club worker"),
      adult("Strip dancer", "Стрип-танцор", "Strip dancer"),
      adult("Dating ekspert", "Эксперт по дейтингу", "Dating expert"),
      adult("Soxta psixolog", "Фейковый психолог", "Fake psychologist"),
      adult("Pranker", "Пранкер", "Prankster"),
      adult("Party DJ", "Ди-джей вечеринок", "Party DJ"),
    ],
    soglik: [
      text("To'liq sog'lom", "Полностью здоров", "Perfectly healthy"),
      text("Yurak muammosi", "Проблемы с сердцем", "Heart condition"),
      text("Astma", "Астма", "Asthma"),
      text("Allergiya", "Аллергия", "Allergy"),
      text("Qandli diabet", "Сахарный диабет", "Diabetes"),
      text("Juda chidamli", "Очень вынослив", "Very resilient"),
      text("Tez charchaydi", "Быстро устает", "Tires quickly"),
      text("Ko'rish past", "Плохое зрение", "Poor eyesight"),
      text("Eshitish muammo", "Проблемы со слухом", "Hearing problems"),
      text("Immunitet kuchli", "Сильный иммунитет", "Strong immunity"),
      text("Doimiy og'riq", "Хроническая боль", "Chronic pain"),
      text("Tez sog'ayadi", "Быстро восстанавливается", "Heals quickly"),
      text("Qon bosimi yuqori", "Высокое давление", "High blood pressure"),
      text("Sovuqqa chidamsiz", "Плохо переносит холод", "Sensitive to cold"),
      text("Issiqqa chidamsiz", "Плохо переносит жару", "Sensitive to heat"),
      text("Oyoq jarohati", "Травма ноги", "Leg injury"),
      text("Sport jarohati", "Спортивная травма", "Sports injury"),
      text("Juda baquvvat", "Очень крепкий", "Very strong"),
      // 18+
      adult("Libido juda yuqori", "Очень высокое либидо", "Very high libido"),
      adult("Tez qo'zg'aladi", "Легко возбуждается", "Gets aroused easily"),
      adult("Seks terroristi", "Секс-террорист", "Sex terrorist"),
      adult("Oshqozoni yo'q", "Нет желудка", "No stomach"),
    ],
    xarakter: [
      text("Lider", "Лидер", "Leader"),
      text("Manipulyator", "Манипулятор", "Manipulator"),
      text("Qo'rqoq", "Трус", "Coward"),
      text("Hazilkash", "Шутник", "Jokester"),
      text("Sovuqqon", "Хладнокровный", "Cold-blooded"),
      text("Jahldor", "Вспыльчивый", "Hot-tempered"),
      text("Mehribon", "Добрый", "Kind"),
      text("Egoist", "Эгоист", "Selfish"),
      text("Ishonchli", "Надежный", "Reliable"),
      text("Dangasa", "Ленивый", "Lazy"),
      text("Intizomli", "Дисциплинированный", "Disciplined"),
      text("Sabrsiz", "Нетерпеливый", "Impatient"),
      text("Aqlli", "Умный", "Smart"),
      text("Hiylakor", "Хитрый", "Cunning"),
      text("Optimist", "Оптимист", "Optimist"),
      text("Pessimist", "Пессимист", "Pessimist"),
      text("Jamoaviy", "Командный игрок", "Team player"),
      text("Risk qiluvchi", "Любитель риска", "Risk-taker"),
      // 18+
      adult("Seksual dominant", "Сексуальный доминант", "Sexual dominant"),
      adult("Mazoxist", "Мазохист", "Masochist"),
      adult("Sadist", "Садист", "Sadist"),
      adult("Nimfoman", "Нимфоман", "Nymphomaniac"),
      adult("Voyeur", "Вуайерист", "Voyeur"),
    ],
    skill: [
      text("Ov qilishni biladi", "Умеет охотиться", "Knows how to hunt"),
      text(
        "Suv topishni biladi",
        "Умеет находить воду",
        "Knows how to find water",
      ),
      text("Ta'mirlashni biladi", "Умеет чинить", "Can repair things"),
      text("Ovqat pishirishni biladi", "Умеет готовить", "Can cook"),
      text("Elektr tuzatadi", "Чинит электрику", "Fixes electrical systems"),
      text(
        "Tibbiy yordam ko'rsatadi",
        "Оказывает первую помощь",
        "Gives medical aid",
      ),
      text("O't yoqishni biladi", "Умеет разводить огонь", "Can start a fire"),
      text(
        "Bog'dorchilik qila oladi",
        "Умеет заниматься садоводством",
        "Can garden",
      ),
      text(
        "Navigatsiyani biladi",
        "Разбирается в навигации",
        "Knows navigation",
      ),
      text(
        "Himoyalanishni biladi",
        "Умеет защищаться",
        "Can defend themselves",
      ),
      text("Reja tuzadi", "Умеет строить планы", "Plans strategically"),
      text(
        "Tez qaror qiladi",
        "Быстро принимает решения",
        "Makes quick decisions",
      ),
      text("Resurs topadi", "Находит ресурсы", "Finds resources"),
      text("Savdo qila oladi", "Умеет торговаться", "Can negotiate trades"),
      text("Omon qolishni biladi", "Знает, как выживать", "Knows survival"),
      text("Qidiruv qila oladi", "Умеет искать", "Good at searching"),
      text(
        "Muzlatmasdan saqlaydi",
        "Умеет хранить без холодильника",
        "Preserves without refrigeration",
      ),
      text("Odamlarni ishontiradi", "Умеет убеждать людей", "Persuades people"),
      // 18+
      adult(
        "Odamlarni manipulyatsiya qila oladi",
        "Умеет манипулировать людьми",
        "Can manipulate people",
      ),
      adult(
        "Spirtli ichimlik tayyorlaydi",
        "Умеет гнать самогон",
        "Can brew alcohol",
      ),
      adult("Qurol yasaydi", "Умеет делать оружие", "Can make weapons"),
      adult("Zahar tayyorlaydi", "Умеет готовить яды", "Can prepare poisons"),
      adult(
        "Hujjat qalbaki qiladi",
        "Умеет подделывать документы",
        "Can forge documents",
      ),
    ],
    bagaj: [
      text("Dori qutisi", "Аптечка", "First-aid kit"),
      text("Asboblar to'plami", "Набор инструментов", "Tool kit"),
      text("10 kunlik ovqat", "Еда на 10 дней", "10 days of food"),
      text("Suv filtri", "Фильтр для воды", "Water filter"),
      text("Generator", "Генератор", "Generator"),
      text("Fonar", "Фонарь", "Flashlight"),
      text("Pichoq", "Нож", "Knife"),
      text("Radio", "Радио", "Radio"),
      text("Yoqilg'i", "Топливо", "Fuel"),
      text("Arqon", "Веревка", "Rope"),
      text("Gaz plita", "Газовая плитка", "Gas stove"),
      text("Issiq kiyim", "Теплая одежда", "Warm clothing"),
      text("Kompas", "Компас", "Compass"),
      text("Dori o'simliklar", "Лекарственные травы", "Medicinal herbs"),
      text("Laptop (offline)", "Ноутбук (офлайн)", "Laptop (offline)"),
      text("Chodir", "Палатка", "Tent"),
      text("Kitoblar", "Книги", "Books"),
      text("Hech narsa", "Ничего", "Nothing"),
      // 18+
      adult("Prezervativlar", "Презервативы", "Condoms"),
      adult("Erkak o'yinchog'i", "Мужская игрушка", "Male toy"),
      adult("Ayol o'yinchog'i", "Женская игрушка", "Female toy"),
      adult("Spirtli ichimliklar", "Алкоголь", "Alcohol supply"),
      adult("Anal probka", "Анальная пробка", "Butt plug"),
      adult("Seks videolar", "Секс-видео", "Sex videos"),
      adult("Eva Elfie o'zi", "Сама Ева Эльфи", "Eva Elfie herself"),
      adult("Kuchli brat", "Крепкий братан", "Big strong dude"),
      adult("Viagra", "Виагра", "Viagra"),
    ],
    fakt: [
      text("Yashirincha boy", "Тайно богат", "Secretly wealthy"),
      text(
        "2 yil ko'chada yashagan",
        "2 года жил на улице",
        "Lived on the streets for 2 years",
      ),
      text(
        "Oldin qamoqda bo'lgan",
        "Раньше сидел в тюрьме",
        "Formerly imprisoned",
      ),
      text("Genius (IQ 150)", "Гений (IQ 150)", "Genius (IQ 150)"),
      text("3 ta farzandi bor", "У него трое детей", "Has 3 children"),
      text("Doim yolg'on gapiradi", "Постоянно лжет", "Always lies"),
      text("Sobiq harbiy", "Бывший военный", "Former military"),
      text("Firibgar", "Мошенник", "Con artist"),
      text("Omadli", "Везучий", "Lucky"),
      text("Qarzdor", "В долгах", "In debt"),
      text("Mashhur bo'lgan", "Был знаменит", "Used to be famous"),
      text(
        "Sirli kasalligi bor",
        "У него загадочная болезнь",
        "Has a mysterious illness",
      ),
      text("Omadsiz", "Невезучий", "Unlucky"),
      text("Hammani ishontiradi", "Умеет убедить всех", "Can convince anyone"),
      text(
        "O'zi haqida yolg'on gapiradi",
        "Лжет о себе",
        "Lies about themselves",
      ),
      text("Yetim bo'lib o'sgan", "Вырос сиротой", "Grew up an orphan"),
      text("Katta tajribaga ega", "Имеет большой опыт", "Highly experienced"),
      text(
        "Oldin yetakchi bo'lgan",
        "Раньше был лидером",
        "Used to be a leader",
      ),
      // 18+
      adult("Gey", "Гей", "Gay"),
      adult("Lezbi", "Лесбиянка", "Lesbian"),
      adult("Biseksual", "Бисексуал", "Bisexual"),
      adult("Bulbulchasi turмaydi", "Птичка не встаёт", "Can't get it up"),
      adult("Bulbulchasi yo'q", "Птички нет", "Has no birdie"),
      adult("Ekstremal rashkchi", "Экстремально ревнивый", "Extremely jealous"),
      adult("Kuni ustasi", "Мастер куни", "Cunnilingus master"),
      adult(
        "Hayvonlarni juda sevadi",
        "Очень любит животных",
        "Loves animals a lot",
      ),
      adult(
        "O'pishmay turolmaydi",
        "Не может без поцелуев",
        "Can't go without kissing",
      ),
      adult("Guruhni yoqtiradi", "Любит групповое", "Likes group activities"),
      adult("Yashirin bigamist", "Тайный бигамист", "Secret bigamist"),
      adult("Pornofilm yulduzi bo'lgan", "Снимался в порно", "Was a porn star"),
      adult("Yashirin homilador", "Тайно беременна", "Secretly pregnant"),
      adult(
        "Qonundan qochyapti",
        "Скрывается от закона",
        "Hiding from the law",
      ),
      adult("Jinsini o'zgartirgan", "Сменил пол", "Changed gender"),
    ],
  },
  disasters: [
    {
      name: text("Yadro urushi", "Ядерная война", "Nuclear war"),
      description: text(
        "Dunyo global yadro urushi natijasida vayron bo'lgan. Shaharlar kulga aylangan, havoda radiatsiya darajasi o'ta yuqori. Tashqariga chiqish deyarli o'lim bilan barobar. Oziq-ovqat va suv zahiralari ifloslangan. Bunker ichidagi resurslar cheklangan va har bir odam qo'shimcha yuk hisoblanadi. Kim bunkerda qolsa, insoniyatning kelajagini tiklashda rol o'ynashi mumkin.",
        "Мир разрушен глобальной ядерной войной. Города превратились в пепел, а уровень радиации в воздухе смертельно высок. Выход наружу почти равен смерти. Запасы еды и воды заражены. Ресурсы внутри бункера ограничены, и каждый человек становится дополнительной нагрузкой. Те, кто останется в бункере, могут сыграть роль в восстановлении будущего человечества.",
        "The world has been devastated by a global nuclear war. Cities have turned to ash, and radiation levels in the air are extremely high. Going outside is almost certain death. Food and water supplies are contaminated. Resources inside the bunker are limited, and every extra person is a burden. Whoever stays in the bunker may help rebuild humanity's future.",
      ),
    },
    {
      name: text("Global virus", "Глобальный вирус", "Global virus"),
      description: text(
        "O'ta yuqumli va tez o'ldiruvchi virus butun dunyoga tarqalgan. Odamlarning 90% halok bo'lgan. Tirik qolganlar ham immunitet yoki yashirin kasallik sabab xavf ostida. Har qanday kichik kasallik ham butun bunkerni yo'q qilishi mumkin. Shifokorlar va sog'lom odamlar hayotiy ahamiyatga ega.",
        "Сверхзаразный и быстро убивающий вирус распространился по всему миру. Погибли 90% людей. Даже выжившие находятся под угрозой из-за иммунитета или скрытых болезней. Любая мелкая болезнь может уничтожить весь бункер. Врачи и по-настоящему здоровые люди имеют жизненно важное значение.",
        "A highly contagious and fast-killing virus has spread across the world. Ninety percent of humanity has died. Even the survivors remain at risk because of immunity issues or hidden illnesses. Any minor sickness could wipe out the entire bunker. Doctors and genuinely healthy people are critically important.",
      ),
    },
    {
      name: text("AI isyoni", "Восстание ИИ", "AI uprising"),
      description: text(
        "Sun'iy intellekt tizimlari nazoratdan chiqib, insoniyatga qarshi ishlay boshlagan. Dronlar, robotlar va tizimlar odamlarni ovlamoqda. Elektron qurilmalar xavfli. Faqat texnik bilimga ega yoki yashirin yashay oladiganlar omon qolishi mumkin. Har qanday texnologiya ham najot, ham xavf bo'lishi mumkin.",
        "Системы искусственного интеллекта вышли из-под контроля и начали действовать против человечества. Дроны, роботы и автоматические системы охотятся на людей. Электронные устройства опасны. Выжить смогут только те, у кого есть технические знания или способность скрываться. Любая технология может быть и спасением, и угрозой.",
        "Artificial intelligence systems have broken free from human control and turned against humanity. Drones, robots, and automated systems are hunting people. Electronic devices are dangerous. Only people with technical knowledge or the ability to stay hidden may survive. Any technology can be both salvation and threat.",
      ),
    },
    {
      name: text("Muz davri", "Ледниковый период", "Ice age"),
      description: text(
        "Yer keskin sovib ketgan, harorat -50 darajagacha tushgan. Tashqarida uzoq vaqt qolish imkonsiz. Issiqlik, kiyim va boshpana eng muhim resursga aylangan. Oziq-ovqat topish qiyin, ov qilish xavfli. Sovuqqa chidamsiz odamlar uzoq yashay olmaydi.",
        "Земля резко остыла, температура опустилась до -50 градусов. Долго находиться снаружи невозможно. Тепло, одежда и укрытие стали самыми важными ресурсами. Найти еду трудно, а охота опасна. Люди, плохо переносящие холод, долго не протянут.",
        "The Earth has frozen dramatically, with temperatures dropping to -50 degrees. Staying outside for long is impossible. Heat, clothing, and shelter have become the most important resources. Food is hard to find, and hunting is dangerous. People who cannot withstand the cold will not last long.",
      ),
    },
    {
      name: text("Issiq apokalipsis", "Жаркий апокалипсис", "Heat apocalypse"),
      description: text(
        "Global isish tufayli Yer yashab bo'lmas darajada qizib ketgan. Suv tanqisligi kuchli, harorat 60°C dan yuqori. Odamlar suvsiz tez halok bo'lmoqda. Har bir tomchi suv hayot bilan teng. Issiqqa chidamli va resurs topa oladiganlar yashab qoladi.",
        "Из-за глобального потепления Земля раскалилась до почти непригодного для жизни состояния. Нехватка воды критическая, а температура превышает 60°C. Люди быстро погибают без воды. Каждая капля стоит жизни. Выживут те, кто переносит жару и умеет добывать ресурсы.",
        "Because of global warming, the Earth has heated to near-unlivable conditions. Water scarcity is severe, and temperatures are above 60°C. People die quickly without water. Every drop is as valuable as life itself. Those who can handle the heat and find resources will survive.",
      ),
    },
    {
      name: text(
        "Zombi apokalipsisi",
        "Зомби-апокалипсис",
        "Zombie apocalypse",
      ),
      description: text(
        "Noma'lum virus odamlarni agressiv zombilarga aylantirgan. Ular tez harakat qiladi va soni ko'p. Tashqarida har bir shovqin o'limga olib kelishi mumkin. Himoyalanish, jamoaviy ishlash va tez qaror qabul qilish eng muhim omilga aylangan.",
        "Неизвестный вирус превратил людей в агрессивных зомби. Они быстрые и их очень много. Снаружи любой шум может привести к смерти. Умение защищаться, работать в команде и быстро принимать решения стало решающим фактором.",
        "An unknown virus has turned people into aggressive zombies. They move fast and their numbers are huge. Outside, any noise can lead to death. Defense, teamwork, and quick decision-making have become the most important survival factors.",
      ),
    },
    // 18+ disasters
    {
      isAdult: true,
      name: text(
        "Demografik kollaps",
        "Демографический коллапс",
        "Demographic collapse",
      ),
      description: text(
        "Butun dunyoda tug'ilish deyarli to'xtab qoldi — noma'lum sabab bilan inson nasl qoldira olmayapti. Insoniyatni davom ettirish uchun bunker odamlari nasl ko'paytirish mas'uliyatini zimmasiga olishi kerak. Kim bu rolni bajarishga tayyor va kim bunga qodir?",
        "По всему миру рождаемость почти прекратилась — по неизвестной причине люди больше не могут воспроизводить потомство. Чтобы продолжить человечество, люди в бункере должны взять на себя ответственность за продолжение рода. Кто готов к этой роли и кто способен на это?",
        "Across the world, birth rates have nearly stopped — for unknown reasons, humans can no longer reproduce. To continue humanity, the bunker occupants must take responsibility for reproduction. Who is ready for this role, and who is capable?",
      ),
    },
    {
      isAdult: true,
      name: text(
        "Jinsiy tanlash epidemiyasi",
        "Эпидемия полового отбора",
        "Sexual selection epidemic",
      ),
      description: text(
        "Virus faqat ma'lum biologik xususiyatlarga ega odamlarni omon qoldirdi. Yashab qolish uchun bunker aholisi o'rtasida jufti halol tanlash majburiy bo'ldi. Jamoa hayot davom etishi uchun eng mas'uliyatli qarorlarni qabul qilishi kerak.",
        "Вирус оставил в живых только людей с определёнными биологическими характеристиками. Для выживания среди жителей бункера стал обязательным выбор партнёра. Команда должна принять самые ответственные решения для продолжения жизни.",
        "The virus only left alive people with certain biological traits. For survival, partner selection among bunker residents became mandatory. The team must make the most responsible decisions for life to continue.",
      ),
    },
    {
      isAdult: true,
      name: text("Narkotik urushi", "Наркотическая война", "Drug war"),
      description: text(
        "Davlatlar qulagach, narkokarteller butun hududni qo'lga oldi. Tashqarida kuch — qurol va giyohvand moddalar. Bunker ichida ham ba'zilar tibbiy narkotiklarga muhtoj. Kim boshqaradi, kim qul bo'ladi — bu savol hayot va o'lim o'rtasidagi farqni belgilaydi.",
        "После краха государств наркокартели захватили все территории. На улицах власть — оружие и наркотики. Внутри бункера тоже некоторые нуждаются в медицинских наркотиках. Кто управляет, кто становится рабом — этот вопрос определяет разницу между жизнью и смертью.",
        "After states collapsed, drug cartels took over all territories. Outside, power means weapons and drugs. Inside the bunker, some people also need medical narcotics. Who controls, who becomes enslaved — this question determines the line between life and death.",
      ),
    },
  ],
  situations: [
    {
      text: text(
        "Bunkerda suv filtri buzildi va ichimlik suvi tez tugayapti. Suv topa oladigan yoki uni tejay oladigan odamlar juda muhimga aylandi. Kim suv resurslarini boshqarishga eng mos deb o'ylaysiz va kim ortiqcha yuk hisoblanadi?",
        "В бункере сломался фильтр для воды, и запас питьевой воды быстро заканчивается. Люди, которые могут найти воду или экономно ее использовать, стали особенно важны. Кто, по-вашему, лучше всего справится с управлением водными ресурсами, а кто является лишней нагрузкой?",
        "The bunker's water filter has broken, and the supply of drinking water is running out fast. People who can find water or use it efficiently have become extremely important. Who do you think is best suited to manage water resources, and who has become extra weight?",
      ),
    },
    {
      text: text(
        "Tashqarida kichik xavfsiz hudud topildi, lekin u yerga borish uchun xavfli yo'l bosib o'tish kerak. Faqat 2-3 kishi borishi mumkin. Kim borishi kerak va kim bunkerda qolishi kerak?",
        "Снаружи нашли небольшой безопасный участок, но до него нужно пройти опасный путь. Туда могут отправиться только 2-3 человека. Кто должен идти, а кто должен остаться в бункере?",
        "A small safe zone has been found outside, but reaching it requires crossing a dangerous route. Only 2-3 people can go. Who should go, and who should stay in the bunker?",
      ),
    },
    {
      text: text(
        "Bunker ichida kimdir kasallik alomatlarini ko'rsatmoqda. Agar bu virus bo'lsa, hamma xavf ostida. Uni chiqarib yuborish kerakmi yoki davolashga urinib ko'rish kerakmi?",
        "Кто-то в бункере показывает признаки болезни. Если это вирус, под угрозой окажутся все. Стоит ли выгнать этого человека или попытаться лечить?",
        "Someone in the bunker is showing signs of illness. If it's a virus, everyone is at risk. Should this person be expelled, or should the group try to treat them?",
      ),
    },
    {
      text: text(
        "Oziq-ovqat faqat 5 kunga yetadi. Ovqatni kamaytirish yoki ba'zi odamlarni chiqarib yuborish kerak. Kim eng kam foydali deb hisoblanadi?",
        "Еды хватит только на 5 дней. Нужно сократить пайки или вывести кого-то из бункера. Кого вы считаете наименее полезным?",
        "The food supply will last only 5 days. Rations must be cut, or some people must be removed. Who do you consider the least useful?",
      ),
    },
    {
      text: text(
        "Generator ishlamayapti va elektr yo'q. Uni tuzatish uchun texnik bilim kerak. Kim bu vazifani bajara oladi va agar hech kim qila olmasa, kimni qurbon qilishga tayyorsiz?",
        "Генератор не работает, и электричества нет. Чтобы его починить, нужны технические знания. Кто сможет справиться с этой задачей, и если никто не сможет, кем вы готовы пожертвовать?",
        "The generator has failed, and there is no electricity. Fixing it requires technical knowledge. Who can handle this task, and if no one can, who are you ready to sacrifice?",
      ),
    },
    {
      text: text(
        "Bunkerga noma'lum odam kirishni so'ramoqda. U o'zini foydali deb aytyapti, lekin joy yo'q. Kimni chiqarib, uning o'rniga yangi odamni olish kerak?",
        "Неизвестный человек просится в бункер. Он утверждает, что может быть полезен, но места нет. Кого стоит вывести, чтобы впустить нового человека?",
        "An unknown person is asking to enter the bunker. They claim to be useful, but there is no space. Who should be removed to let this newcomer in?",
      ),
    },
    {
      text: text(
        "Ichkarida janjal kuchaymoqda. Ba'zi odamlar boshqalarni boshqarishga urinmoqda. Liderlik muhim bo'ldi. Kim lider bo'lishi kerak va kim jamoani buzmoqda?",
        "Конфликт внутри бункера усиливается. Некоторые люди пытаются управлять остальными. Лидерство стало критически важным. Кто должен стать лидером, а кто разрушает команду?",
        "Conflict inside the bunker is escalating. Some people are trying to control the rest. Leadership has become crucial. Who should lead, and who is tearing the group apart?",
      ),
    },
    {
      text: text(
        "Sovuq kuchaymoqda va issiq kiyim yetarli emas. Kim sovuqqa chidamsiz va kim yashab qolish imkoniyati kam?",
        "Холод усиливается, а теплой одежды не хватает. Кто хуже всего переносит холод и у кого меньше шансов выжить?",
        "The cold is getting worse, and there are not enough warm clothes. Who is most vulnerable to the cold, and who has the lowest chance of survival?",
      ),
    },
    {
      text: text(
        "Bir nechta foydali resurslar yo'qolib qoldi. Kimdir yashirincha saqlayapti degan gumon bor. Kimga ishonasiz va kimni tekshirish kerak?",
        "Несколько полезных ресурсов пропали. Есть подозрение, что кто-то их тайно прячет. Кому вы доверяете и кого нужно проверить?",
        "Several useful resources have gone missing. There is suspicion that someone is secretly hiding them. Who do you trust, and who should be searched?",
      ),
    },
    {
      text: text(
        "Tashqarida qisqa vaqtga chiqish imkoniyati bor. Resurs topish mumkin, lekin xavf katta. Kimni yuborasiz?",
        "Есть возможность ненадолго выйти наружу. Можно найти ресурсы, но риск очень высок. Кого вы отправите?",
        "There is a brief chance to go outside. Useful resources may be found, but the risk is high. Who do you send?",
      ),
    },
    {
      text: text(
        "Bunkerda faqat 1 ta tibbiy yordam vositasi qoldi. Uni kimga berish kerak? Eng foydaliga yoki eng kasalga?",
        "В бункере осталось только одно медицинское средство. Кому его отдать: самому полезному или самому больному?",
        "Only one medical aid item remains in the bunker. Who should receive it: the most useful person or the sickest one?",
      ),
    },
    {
      text: text(
        "Bunkerda joy kamaydi, yana 1 odam chiqishi kerak. Bu safar qaror juda qiyin - hamma foydali ko'rinadi. Kimni qurbon qilasiz?",
        "Места в бункере стало еще меньше, и еще один человек должен уйти. На этот раз решение особенно трудное - все кажутся полезными. Кого вы принесете в жертву?",
        "Space in the bunker has shrunk again, and one more person must leave. This time the decision is especially hard - everyone seems useful. Who will you sacrifice?",
      ),
    },
    {
      text: text(
        "Tashqarida signal kelmoqda - ehtimol qutqaruvchilar. Lekin bu tuzoq ham bo'lishi mumkin. Kim borib tekshiradi?",
        "Снаружи поступает сигнал - возможно, это спасатели. Но это может быть и ловушка. Кто пойдет проверить?",
        "A signal is coming from outside - it may be rescuers. But it could also be a trap. Who will go check?",
      ),
    },
    {
      text: text(
        "Kimdir o'zini boshqalardan kuchliroq deb ko'rsatmoqda va boshqaruvni qo'lga olishga urinmoqda. Uni to'xtatish kerakmi yoki lider qilish kerakmi?",
        "Кто-то демонстрирует силу и пытается захватить власть. Нужно ли его остановить или лучше сделать лидером?",
        "Someone is presenting themselves as stronger than the others and trying to take control. Should they be stopped, or should they become the leader?",
      ),
    },
    {
      text: text(
        "Oziq-ovqat noto'g'ri taqsimlangan va kimdir ko'proq olayotgani aniqlandi. Uni jazolash kerakmi yoki e'tiborsiz qoldirish kerakmi?",
        "Еда распределена несправедливо, и стало ясно, что кто-то берет больше остальных. Нужно ли его наказать или лучше оставить все как есть?",
        "Food has been distributed unfairly, and it turns out someone has been taking more than their share. Should that person be punished or ignored?",
      ),
    },
    {
      text: text(
        "Bunker ichida ruhiy bosim kuchaymoqda. Ba'zi odamlar sinib ketmoqda. Kim jamoani ushlab turadi va kim xavfli holatda?",
        "Психологическое давление в бункере усиливается. Некоторые люди начинают ломаться. Кто удерживает команду вместе, а кто уже в опасном состоянии?",
        "Psychological pressure inside the bunker is rising. Some people are starting to break down. Who is keeping the team together, and who is becoming dangerous?",
      ),
    },
    {
      text: text(
        "Bir odam juda foydali, lekin sog'ligi yomon. Uni saqlab qolish kerakmi yoki sog'lom, lekin kamroq foydali odamni tanlaysizmi?",
        "Один человек очень полезен, но у него плохое здоровье. Стоит ли сохранить его или выбрать более здорового, но менее полезного человека?",
        "One person is extremely useful, but their health is poor. Should they be kept, or would you choose someone healthier but less useful?",
      ),
    },
    {
      text: text(
        "Tashqarida yangi resurs topildi, lekin uni olish uchun jamoa bo'linishi kerak. Kimlar ketadi va kimlar qoladi?",
        "Снаружи найден новый ресурс, но чтобы добыть его, команде придется разделиться. Кто пойдет, а кто останется?",
        "A new resource has been found outside, but the team must split up to get it. Who goes, and who stays?",
      ),
    },
    {
      text: text(
        "Bunkerda oxirgi joylar qoldi. Endi har bir qaror oxirgi bo'lishi mumkin. Kim albatta qolishi kerak?",
        "В бункере остались последние места. Теперь каждое решение может стать последним. Кто обязательно должен остаться?",
        "Only the final spots remain in the bunker. Every decision from now on could be the last. Who absolutely must stay?",
      ),
    },
    {
      text: text(
        "Oxirgi round yaqin. Endi faqat eng foydali odamlar qolishi kerak. Kim haqiqatan ham insoniyatni tiklay oladi?",
        "Финальный раунд близко. Теперь должны остаться только самые полезные люди. Кто действительно способен восстановить человечество?",
        "The final round is near. Only the most useful people should remain now. Who can truly help rebuild humanity?",
      ),
    },
    // 18+ situations
    {
      isAdult: true,
      text: text(
        "Bunkerda faqat bitta juft xona bor va ikki juft bor. Qolganlar ochiq joyda yotishi kerak. Lekin tungi 'ovozlar' hammani uyqusizlikka olib kelyapti. Jamoa bu vaziyatni qanday hal qiladi?",
        "В бункере есть только одна отдельная комната, и есть две пары. Остальные должны спать в открытом пространстве. Но ночные 'звуки' лишают всех сна. Как команда решит эту ситуацию?",
        "The bunker has only one private room, and there are two couples. The rest must sleep in the open space. But the nightly 'sounds' are keeping everyone awake. How does the team resolve this situation?",
      ),
      difficulty: BunkerDifficulty.MEDIUM,
    },
    {
      isAdult: true,
      text: text(
        "Insoniyatni davom ettirish uchun bunker aholisi bolalar tug'ishi kerak. Lekin bu uchun juftlar tanlash kerak. Kimni kim bilan jufti qilasiz va kim rozi bo'lmaydi?",
        "Для продолжения человечества жители бункера должны рожать детей. Но для этого нужно выбрать пары. Кого с кем вы поженили бы и кто откажется?",
        "To continue humanity, bunker residents must have children. But this requires choosing couples. Who would you pair with whom, and who would refuse?",
      ),
      difficulty: BunkerDifficulty.HARD,
    },
    {
      isAdult: true,
      text: text(
        "Bunkerda birov spirtli ichimlik yashirincha olib kirganligi aniqlandi. Bir kecha hamma biroz ichdi. Ertasiga muhim qaror qabul qilish kerak, lekin ba'zilar hali hushyor emas. Kim qaror qiladi va mast odamga nima qilish kerak?",
        "Выяснилось, что кто-то тайно принёс в бункер алкоголь. Однажды ночью все немного выпили. На следующий день нужно принять важное решение, но некоторые ещё не трезвы. Кто принимает решение и что делать с пьяным человеком?",
        "It was discovered that someone secretly brought alcohol into the bunker. One night everyone drank a little. The next day an important decision must be made, but some are still not sober. Who decides, and what should be done with the drunk person?",
      ),
      difficulty: BunkerDifficulty.MEDIUM,
    },
    {
      isAdult: true,
      text: text(
        "Ikki kishi orasida yashirin munosabat boshlanganini hamma sezmoqda. Bu jamoa ruhiyatiga ta'sir qilyapti — ba'zilar rashk qilmoqda, ba'zilar xursand. Bunker rahbari bu vaziyatga aralashishi kerakmi?",
        "Все замечают, что между двумя людьми начались тайные отношения. Это влияет на дух команды — одни ревнуют, другие рады. Должен ли лидер бункера вмешаться в эту ситуацию?",
        "Everyone notices that a secret relationship has started between two people. This is affecting team morale — some are jealous, others are happy. Should the bunker leader intervene in this situation?",
      ),
      difficulty: BunkerDifficulty.EASY,
    },
    {
      isAdult: true,
      text: text(
        "Birisi boshqasining roziligisiz uni kuzatib, yozib yurganini aniqlashdi. Bunker ichida maxfiylik yo'q deyarli. Bu odam xavfli deb hisoblash kerakmi yoki uni tushunish kerakmi?",
        "Выяснилось, что один человек следил за другим и записывал его без согласия. В бункере почти нет приватности. Следует ли считать этого человека опасным или нужно его понять?",
        "It was discovered that one person was watching and recording another without consent. There is almost no privacy in the bunker. Should this person be considered dangerous, or should they be understood?",
      ),
      difficulty: BunkerDifficulty.HARD,
    },
  ],
};
