# Boshpana / Jamoaviy.uz

Telegram ichida ishlaydigan jamoaviy o'yinlar platformasi. Hozir repo ichida 2 ta o'yin bor:

- `BUNKER`
- `MAFIA`

Loyiha monorepo ko'rinishida yozilgan. Frontend Next.js, backend Fastify + Socket.IO, database Prisma + PostgreSQL, auth va session oqimi Telegram bilan integratsiyalangan.

## Nima qiladi

Platforma foydalanuvchiga quyidagilarni beradi:

- Telegram orqali login qilish
- dashboard ichidan yangi room yaratish
- mavjud roomga qo'shilish
- real-time lobby va game holatini ko'rish
- o'yin fazalarini Socket.IO orqali boshqarish
- admin panel orqali kontent va statistikani boshqarish

Asosiy domain:

- `Room` - o'yin konteyneri
- `Player` - room ichidagi o'yinchi
- `GameType` - `BUNKER` yoki `MAFIA`
- har bir game uchun alohida `GameService`, alohida public state shape va alohida UI experience mavjud

## Monorepo struktura

```text
.
├── apps/
│   ├── api/                   # Fastify API, Socket.IO, Prisma, Telegram bot
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── seed-content.ts
│   │   └── src/
│   │       ├── bot/
│   │       ├── games/
│   │       │   ├── bunker/
│   │       │   ├── mafia/
│   │       │   └── registry.ts
│   │       ├── routes/
│   │       ├── services/
│   │       ├── socket/
│   │       └── index.ts
│   └── web/                   # Next.js WebApp, dashboard, room/game UI, admin UI
│       ├── app/
│       ├── components/
│       │   └── games/
│       │       ├── bunker/
│       │       ├── mafia/
│       │       └── shared/
│       ├── lib/
│       └── public/
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
└── README.md
```

## Tech stack

- Frontend: Next.js 15, React 19, Tailwind, Zustand, Socket.IO client
- Backend: Fastify 5, Socket.IO, Prisma, Redis, Grammy
- Database: PostgreSQL
- Infra: Docker Compose
- Auth: Telegram WebApp auth + bot-session flow + optional dev-login

## Ishlash arxitekturasi

### 1. Frontend

`apps/web` foydalanuvchi interfeysini beradi:

- landing page: `/`
- Telegram entry page: `/telegram`
- login page: `/login`
- dashboard: `/dashboard`
- game create pages:
  - `/dashboard/create/bunker`
  - `/dashboard/create/mafia`
- room waiting pages:
  - `/room/[code]`
- active game pages:
  - `/game/[code]`
- admin pages:
  - `/admin`
  - `/admin/login`

`GameRouter` avval room metadata ni olib (`/api/rooms/:code/info`), keyin game type bo'yicha to'g'ri experience ni mount qiladi:

- `BunkerExperience`
- `MafiaExperience`

### 2. Backend

`apps/api/src/index.ts` boot vaqtida:

- Fastify server ni ko'taradi
- CORS ni yoqadi
- Redis ulanishini ochadi
- `GameRegistry` ni yaratadi
- auth/public/admin route'larni register qiladi
- Socket.IO server ni ko'taradi
- `RealtimeHub` orqali socket eventlarni game servicelarga ulaydi
- Telegram botni ishga tushiradi

### 3. Game registry

`GameRegistry` ichida 2 ta service mavjud:

- `bunker: BunkerGameService`
- `mafia: MafiaGameService`

Shared route va socket eventlar room `gameType` ga qarab shu servicelarga dispatch qilinadi.

### 4. Realtime layer

`RealtimeHub` Socket.IO qatlamidir. Vazifalari:

- `join_room` orqali socketni roomga ulash
- online/offline presence ni ushlash
- game action eventlarini tegishli servicelarga yuborish
- `room_state` va `timer_update` broadcast qilish
- reconnect paytidagi state yangilanishini soddalashtirish

## Auth va foydalanuvchi oqimi

Repo ichida authning 3 ta asosiy yo'li bor:

### 1. Telegram bot-session auth

Browser `POST /api/auth/bot-session` qiladi.
Backend temporary session yaratadi va foydalanuvchiga Telegram bot link qaytaradi.
User bot ichida authni tasdiqlaydi.
Frontend `GET /api/auth/bot-session/:token` ni poll qilib yuradi.
Status `confirmed` bo'lsa JWT oladi.

### 2. Telegram WebApp auth

Telegram ichidagi WebApp `initData` yuboradi:

- `POST /api/auth/telegram-webapp`
- kerak bo'lsa `POST /api/auth/telegram-webapp/phone`

### 3. Dev auth

Faqat `ENABLE_DEV_AUTH=1` bo'lsa:

- `POST /api/auth/dev-login`

Bu lokal ishlab chiqishda Telegram aylanmasdan tez login qilish uchun kerak.

## Asosiy HTTP route'lar

### Public game route'lar

- `GET /health`
- `POST /api/rooms/create`
- `POST /api/rooms/:code/join`
- `GET /api/rooms/:code/info`
- `GET /api/rooms/:code/state?sessionId=...`
- `GET /api/meta/card-types`

### Auth route'lar

- `POST /api/auth/bot-session`
- `GET /api/auth/bot-session/:token`
- `POST /api/auth/dev-login`
- `POST /api/auth/telegram-webapp`
- `POST /api/auth/telegram-webapp/phone`
- `GET /api/auth/me`
- `GET /api/me/usage`
- `PATCH /api/me/profile`
- `GET /api/me/active-games`
- `POST /api/rooms/:code/resume`

### Internal admin route'lar

Bu route'lar `x-admin-secret` bilan himoyalangan:

- `GET /internal/admin/schema`
- `GET /internal/admin/stats`
- `GET /internal/admin/:model`
- `POST /internal/admin/:model`
- `PATCH /internal/admin/:model/:id`
- `DELETE /internal/admin/:model/:id`

Admin model surface:

- `gameHistory`
- `rooms`
- `users`
- `cards`
- `disasters`
- `situations`

## Socket event surface

### Shared eventlar

- `join_room`
- `start_game`
- `kick_player`
- `leave_room`
- `end_game`

### Bunker eventlari

- `start_round`
- `start_reveals`
- `reveal_card`
- `advance_turn`
- `start_voting`
- `skip_voting`
- `vote`

### Mafia eventlari

- `mafia:confirm_role`
- `mafia:submit_night_action`
- `mafia:confirm_night_action`
- `mafia:submit_day_vote`
- `mafia:confirm_day_vote`
- `mafia:advance_phase`

### Serverdan clientga

- `room_state`
- `timer_update`
- `action_error`

## Data modeli

Prisma schema umumiy va game-specific modellardan iborat.

### Umumiy modellar

- `User`
- `Room`
- `Player`
- `GameHistory`

### Bunker modellar

- `BunkerGame`
- `BunkerPlayerAttribute`
- `BunkerVote`
- `BunkerCard`
- `BunkerDisaster`
- `BunkerSituation`

### Mafia modellar

- `MafiaGame`
- `MafiaPlayerRole`
- `MafiaNightSubmission`
- `MafiaDayVote`

Muhim enumlar:

- `GameType`
- `RoomStatus`
- `BunkerPhase`
- `MafiaPhase`
- `MafiaRole`
- `MafiaNightActionType`

## Room lifecycle

Har ikkala o'yin ham bir xil room lifecycle bilan ishlaydi:

1. User dashboard orqali room yaratadi
2. Room `LOBBY` holatida turadi
3. Boshqa o'yinchilar join qiladi
4. Host `start_game` qiladi
5. Game-specific phase flow boshlanadi
6. O'yin tugaganda room `FINISHED` yoki `CANCELLED` bo'ladi
7. Natija `GameHistory` ga yoziladi

## Bunker qanday tuzilgan

### Bunker maqsadi

Bir guruh o'yinchi global falokatdan keyin bunkerdan joy olishi kerak. Har bir odamning yashirin kartalari bor. Raundlar davomida odamlar kartalarini ochadi, pitch qiladi va oxirida kim chiqishi kerakligi bo'yicha ovoz beriladi.

### Bunker state tarkibi

Frontend `BunkerRoomState` orqali quyilarni oladi:

- room metadata
- current phase
- round number
- timer
- disaster va situation
- current turn player
- last revealed / last eliminated player
- current user cards
- barcha playerlarning visible cardlari
- voting summary

### Bunker fazalari

- `LOBBY`
- `INTRO`
- `ROUND_REVEAL`
- `ROUND_PITCH`
- `ROUND_COMPLETE`
- `VOTING`
- `FINISHED`

### Bunker flow

Amaldagi oqim:

1. Host room yaratadi
2. `start_game` bosiladi
3. server disaster tanlaydi, kartalarni unique deal qiladi, `INTRO` ga o'tadi
4. `INTRO` dan keyin host `start_round` qiladi
5. game `ROUND_REVEAL` ga o'tadi, round uchun yangi situation tanlanadi
6. host `start_reveals` qiladi
7. current player bir dona yopiq kartasini ochadi
8. ochilgan zahoti faza `ROUND_PITCH` ga o'tadi
9. o'sha player o'zini 2 daqiqa himoya qiladi
10. host yoki current player `advance_turn` qiladi
11. reveal qiladigan odam qolsa yana `ROUND_REVEAL`
12. reveal tugasa `ROUND_COMPLETE`
13. host `start_voting` yoki `skip_voting` qiladi
14. `VOTING` ichida alive playerlar ovoz beradi
15. tie bo'lsa qayta vote bo'ladi
16. winner target ga yetilganda game `FINISHED`

### Bunker timing

- `INTRO`: 120 soniya
- `ROUND_REVEAL`: timer yo'q
- `ROUND_PITCH`: 120 soniya
- `ROUND_COMPLETE`: timer yo'q
- `VOTING`: 45 soniya
- `VOTING` tiebreak: 45 soniya

### Bunker voting logikasi

- faqat `isAlive=true` o'yinchilar vote qiladi
- har voter bir roundda bitta targetga ovoz beradi
- `BunkerVote` unique: `[roomId, roundNumber, voterPlayerId]`
- ko'p ovoz olgan player chiqadi
- tie bo'lsa:
  - tied candidate bo'lmagan alive playerlar qayta ovoz beradi
  - agar hamma tie bo'lib qolsa ham qayta ovoz branch'i bor
  - yana yechilmasa random fallback ishlashi mumkin
- alive count `winnerTarget` ga teng yoki undan kam bo'lsa o'yin tugaydi

### Bunker host control surface

Host quyidagilarni qila oladi:

- game start qilish
- round start qilish
- reveal start qilish
- next turn berish
- voting start qilish
- voting skip qilish
- game tugatish
- player kick qilish

## Mafia qanday tuzilgan

### Mafia maqsadi

Hidden-role strategy game:

- `MAFIA` yashirincha kamaytiradi
- `CITY` taraf topishga harakat qiladi
- `SHERIFF` tekshiradi yoki cheklangan o'q uzadi
- `DOCTOR` heal qiladi
- `CITIZEN` anti-cheat uchun dummy night prompt oladi

### Mafia state tarkibi

Frontend `MafiaPublicState` orqali quyilarni oladi:

- room va composition config
- `nightNumber`, `dayNumber`
- timer
- role confirmations
- alive/dead playerlar
- revealed roles
- mafia teammates
- sheriff check history
- doctor self-heal qoldig'i
- sheriff shot qoldig'i
- pending night selection
- day votes va confirmations

### Mafia fazalari

- `ASSIGN_ROLES`
- `NIGHT`
- `NIGHT_RESULT`
- `DAY_DISCUSSION`
- `DAY_VOTE`
- `DAY_TIEBREAK`
- `DAY_RESULT`
- `FINISHED`

### Mafia flow

Amaldagi oqim:

1. Host lobbyda composition tanlaydi:
   - `mafiaCount`
   - `hasSheriff`
   - `hasDoctor`
   - `maxPlayers`
2. `start_game` bosilganda role bag shuffle qilinadi va playerlarga role biriktiriladi
3. Game `ASSIGN_ROLES` ga o'tadi
4. Har bir alive player `mafia:confirm_role` qiladi
5. Hamma confirm qilgach host `mafia:advance_phase` qiladi
6. Game `NIGHT` ga o'tadi
7. Role bo'yicha harakat:
   - mafia target tanlaydi
   - sheriff check yoki shoot modini tanlaydi
   - doctor heal target tanlaydi
   - citizen fake prompt bo'yicha target tanlaydi
8. Har user night target tanlagach `mafia:confirm_night_action` qiladi
9. Deadline yoki barcha confirmationdan keyin server nightni resolve qiladi
10. `NIGHT_RESULT`
11. Host keyingi fazani boshlaydi
12. `DAY_DISCUSSION`
13. `DAY_VOTE`
14. Agar tie bo'lsa `DAY_TIEBREAK`
15. So'ng `DAY_RESULT`
16. Winner tekshiriladi:
   - mafia alive == 0 -> `CITY` yutadi
   - mafia alive >= city alive -> `MAFIA` yutadi
17. Aks holda yana `NIGHT`

### Mafia timing

Kod bo'yicha hozirgi real timing:

- `ASSIGN_ROLES`: timer yo'q
- `NIGHT`: 60 soniya
- `NIGHT_RESULT`: hozir timer yo'q, host davom ettiradi
- `DAY_DISCUSSION`: 240 soniya
- `DAY_VOTE`: 60 soniya
- `DAY_TIEBREAK`: 60 soniya
- `DAY_RESULT`: hozir timer yo'q, host davom ettiradi

Eslatma:

- `mafia-types.ts` ichida `NIGHT_RESULT=8` va `DAY_RESULT=6` constantlari bor
- lekin amaldagi service flow bu ikki fazani hozir host orqali davom ettiradi

### Mafia night action logikasi

- `MAFIA_KILL`
- `SHERIFF_CHECK`
- `SHERIFF_SHOOT`
- `DOCTOR_HEAL`
- `CITIZEN_GUESS_KILL`
- `CITIZEN_GUESS_HEAL`

Har actor uchun har tunda bitta `MafiaNightSubmission` row bo'ladi:

- unique: `[gameId, nightNumber, actorPlayerId]`
- user tanlovini o'zgartirsa upsert bo'ladi
- `isConfirmed` alohida saqlanadi

### Mafia day voting logikasi

- faqat alive playerlar ovoz beradi
- birinchi bosqich `DAY_VOTE`
- har voter targetni tanlaydi, keyin alohida confirm qiladi
- barcha eligible voter confirm qilsa vote avtomatik resolve bo'ladi
- tie bo'lsa `DAY_TIEBREAK`
- tiebreakda faqat tied candidate'lar target bo'la oladi
- tiebreakda yana tie bo'lsa o'sha kunda hech kim chiqmaydi

## Frontend game modul struktura

Har game UI o'z papkasida izolyatsiya qilingan:

- `apps/web/components/games/bunker/*`
- `apps/web/components/games/mafia/*`

Har modul odatda quyidagilarni o'z ichiga oladi:

- `*-experience.tsx` - asosiy ekran va socket orchestration
- `*-types.ts` - frontend state shape
- UI panel va modal komponentlari
- audio hook
- store / timer patching

Shared game UI:

- `apps/web/components/games/shared/game-action-modal.tsx`

## Backend game service design

Har game service quyidagi masalalarni o'zi boshqaradi:

- room validation
- host permission
- state transition
- timer start/stop
- winner calculation
- DB transaction
- public state serialization
- broadcast uchun shape tayyorlash

Bu yondashuv tufayli:

- Bunker va Mafia bir xil room platformasida yashaydi
- lekin phase, rule va state logic to'liq ajralgan

## Kontent va seedlar

Bunker kontenti DB orqali seed qilinadi:

- `BunkerCard`
- `BunkerDisaster`
- `BunkerSituation`

Asosiy seed fayllar:

- `apps/api/prisma/seed.ts`
- `apps/api/prisma/seed-content.ts`

`data.md` kontent mapping va materiallar bilan bog'liq yordamchi fayl sifatida ishlatiladi.

## Docker va runtime

### Compose servislar

`docker-compose.yml` quyidagilarni ko'taradi:

- `postgres`
- `redis`
- `api`
- `web`

Portlar:

- web: `3000`
- api: `4000`
- postgres: `5432`

### Docker image build

`apps/api/Dockerfile`

- workspace dependency install qiladi
- `yarn workspace api build` ishlatadi
- runtime stage da `yarn start` qiladi

`apps/web/Dockerfile`

- Next standalone build qiladi
- public env qiymatlarini build vaqtida inline qiladi

### Prisma runtime behavior

Muhim:

- `apps/api` build script `prisma generate` qiladi
- `apps/api` start script `prisma db push` qiladi

Demak production-like container start paytida schema database ga `db push` orqali qo'llanadi. Lokal development uchun esa explicit migration ishlatish mumkin:

```bash
yarn prisma:migrate
```

## Local setup

### 1. Env tayyorlash

```bash
cp .env.example .env
```

### 2. Docker orqali ishga tushirish

```bash
docker compose up -d --build
```

### 3. Loglarni ko'rish

```bash
docker compose logs -f api
docker compose logs -f web
```

### 4. Lokal scriptlar

Root scriptlar:

```bash
yarn dev:web
yarn dev:api
yarn build
yarn lint
yarn prisma:generate
yarn prisma:migrate
yarn prisma:seed
```

## Muhim env variable'lar

Database va infra:

- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `REDIS_URL`

API va frontend:

- `API_PORT`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_SITE_URL`
- `API_INTERNAL_URL`

Admin:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_JWT_SECRET`

Auth:

- `JWT_SECRET`
- `JWT_ACCESS_TTL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEB_APP_NAME`
- `TELEGRAM_AUTH_MAX_AGE_SECONDS`
- `ROOM_CREATION_LIMIT_PER_30D`
- `ENABLE_DEV_AUTH`

## Admin panel

Admin qismi 2 bo'lakdan iborat:

- `apps/web` ichidagi admin UI
- `apps/api` ichidagi `/internal/admin/*` route'lar

Admin route'lar `x-admin-secret` bilan himoyalangan. Bu qiymat `ADMIN_JWT_SECRET` dan olinadi.

Admin panel orqali:

- users
- rooms
- cards
- disasters
- situations
- game history
- aggregate stats

boshqariladi.

## Cleanup va history

`BunkerGameService.startCleanupSweeper()` butun platforma uchun stale roomlarni tozalaydi.

Asosiy behavior:

- eski `LOBBY` roomlar cancel qilinadi
- uzoq qolib ketgan `PLAYING` roomlar cancel qilinadi
- eski `FINISHED` va `CANCELLED` roomlar purge qilinadi
- durable analytics uchun `GameHistory` alohida saqlanadi

## Hozirgi muhim operational detail'lar

- `GameHistory` stats uchun source of truth hisoblanadi
- Socket reconnect grace mavjud, shu sabab online/offline indikatori bir zumda flicker qilmaydi
- Bunker va Mafia UI bir xil room platformasini share qiladi, lekin business logic service qatlamida alohida
- Frontend room page va game page route bo'yicha farqlanadi, lekin ikkalasini `GameRouter` boshqaradi

## Troubleshooting

### 1. `docker compose up -d --build` Prisma env conflict bilan yiqilsa

Prisma bir vaqtning o'zida root `.env` va `apps/api/prisma/.env` ni ko'rsa, ayniqsa ikkalasida ham `DATABASE_URL` bo'lsa build to'xtaydi.

Fix:

- `apps/api/prisma/.env` ni o'chiring
- yoki ichidan `DATABASE_URL` ni olib tashlang
- bitta manba sifatida root `.env` ni qoldiring

### 2. Build migration emas, `prisma generate` da yiqilsa

Bu odatda schema yoki env muammosi bo'ladi. `docker compose up --build` migration majburiy degani emas.

### 3. Telegram auth ishlamasa

Tekshiring:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `NEXT_PUBLIC_SITE_URL`
- `TELEGRAM_WEB_APP_NAME`

### 4. Dev login ko'rinmasa

Tekshiring:

- `ENABLE_DEV_AUTH=1`
- `NEXT_PUBLIC_ENABLE_DEV_AUTH=1`

## Qisqa xulosa

Bu repo 2 ta real-time multiplayer o'yinni bitta platforma ichida boshqaradi:

- shared room/auth/socket/platform layer
- alohida Bunker game engine
- alohida Mafia game engine
- Telegram-first UX
- admin va history qatlami

Agar yangi o'yin qo'shilsa, odatda shu pattern takrorlanadi:

1. Prisma schema va enum
2. `apps/api/src/games/<new-game>`
3. `apps/web/components/games/<new-game>`
4. `GameRegistry` dispatch
5. `GameRouter` UI handoff
6. socket event surface

