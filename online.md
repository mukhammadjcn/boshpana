# Online Game Mode — To'liq Implementation Rejasi (v2)

> **Eski reja (v1) bekor qilindi.** Bu hujjat noldan yozilgan va loyihaning hozirgi tuzilmasiga, mavjud kod konvensiyalariga (Game Registry pattern, GameRouter dispatch, per-game folder) mos keltirilgan.

---

## 1. Asosiy tamoyil

**FRIENDS rejimiga (hozirgi kod) hech narsa tegmaslik.**
**ONLINE rejimi ON top of mavjud arxitektura ustiga qo'shiladi**, mavjud fayllarni o'zgartirmasdan, faqat **dispatch nuqtalariga** minimal qo'shimcha kiritiladi.

Reusable komponentlar **faqat haqiqatdan ham ikkala rejim ham ishlatadigan** "presentational leaf" UI bo'laklari uchun ajratiladi (masalan: `PlayerCard`, `Timer`, `VotePanel`). Logika yoki state hech qachon shared papkada bo'lmaydi — har rejim o'zining `experience.tsx`'ida o'z logikasini boshqaradi.

### Izolyatsiya kafolati

| Sizning ishingiz                                                | Online'ga ta'siri |
| --------------------------------------------------------------- | ----------------- |
| `bunker-experience.tsx` ichida bir `useEffect` o'zgartirsangiz  | **Yo'q**          |
| `bunker-game-service.ts` da host-control logic o'zgartirsangiz  | **Yo'q**          |
| `mafia-day.tsx` ichida UI tweak qilsangiz                       | **Yo'q**          |
| `MafiaPublicState` ga yangi field qo'shsangiz (additive)        | Online ham oladi  |
| `shared/player-card.tsx` (yangi) ichida prop interfeysni buzsangiz | Ikkala rejim sinadi (xohlangan, bitta UI) |

> Yagona "tutash nuqta": `MafiaPublicState` / `BunkerPublicState` shape'lari va shared leaf komponentlarning prop interfeyslari. Bularga **additive** o'zgartirish kiritsangiz — xavfsiz; **breaking** kiritsangiz — ikkala rejim sinadi (lekin bu xohlangan, chunki ular bitta data shape va bitta UI atom'ni baham ko'radi).

---

## 2. Uch rejim taqqoslash

Online o'zi ikki sub-rejimga bo'linadi: **PRIVATE** (creator settings bilan yaratadi, link bilan) va **PUBLIC** (matchmake — find or create). Lobby tuzilishi va o'yin oqimi ikkalasida ham bir xil.

> **Asosiy tushuncha PUBLIC haqida**: Public uchun **"yaratish" tugmasi yo'q**. User `[Public qo'shilish]` tugmasini bosadi → tizim mos lobby topsa qo'shadi, topmasa yangi yaratadi va shu user creator bo'ladi. Yaratish/qo'shilish bitta amal. Public lobbyda **sozlamalar avtomatik** (Section 3 formulalari) — creator hech nima tanlamaydi (Bunker'da faqat Normal/Adult pool tanlanadi).

|                          | **FRIENDS** (tegmaslik)                  | **ONLINE — PRIVATE**                                         | **ONLINE — PUBLIC**                                          |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **Lobby yaratish**       | Host yaratadi, kod/link share qiladi     | Creator yaratadi, **kod/link share** qiladi                  | **Yo'q (alohida)** — `[Public qo'shilish]` find-or-create qiladi |
| **Kim qo'shila oladi**   | Faqat link/kod bilan                     | Faqat link/kod bilan                                         | Matchmake (`Public qo'shilish`) — link share qilinmaydi      |
| **Sozlamalar (creator)** | Host tanlaydi (winnerTarget, mafiaCount) | Creator tanlaydi (xuddi Friends kabi)                        | **Hech nima** (Bunker'da faqat Normal/Adult pool tanlovi); composition auto |
| **Boshqaruv (faza)**     | Host barcha fazalarni qo'lda             | Tizim avtomatik (creator faqat lobby boshlaydi)              | Tizim avtomatik                                              |
| **Muloqot**              | Yonma-yon (jonli)                        | Real-time text chat                                          | Real-time text chat                                          |
| **Lobby start trigger**  | Host "Boshlash" bosadi                   | (a) Creator "Boshlash"; YOKI (b) min'ga yetib **hamma** "Tayyorman" tasdiqlasa auto-start | Shu kabi (a) yoki (b)                            |
| **Lobby timeout**        | Yo'q (host hal qiladi)                   | **Yo'q** — to'lguncha kutadi, kimlardir kiradi/chiqadi       | **Yo'q** — shu kabi                                          |
| **Creator kick**         | Host kick'i bor                          | Creator kick'i bor (hozirgi pattern bilan bir xil)           | Shu kabi                                                     |
| **Creator chiqib ketsa** | Room CANCELLED (hozirgi xulq)            | **Host transfer**: 5 daqiqa grace, keyin eng erta `joinedAt` o'yinchiga | Shu kabi                                          |
| **Host Controls (game)** | Har faza uchun tugmalar                  | Faqat lobby'da (Boshlash + Kick)                             | Shu kabi                                                     |
| **Pitch (Bunker)**       | Host `advance_turn` bosadi               | Joriy o'yinchi "yakunlash" bosadi yoki timer                 | Shu kabi                                                     |
| **Bottom bar (game)**    | Host controls + "Mening kartalarim"      | Chat panel + "Mening kartalarim"                             | Shu kabi                                                     |
| **Adult filter (Bunker)**| Lobby'da (host tanlaydi)                 | Creator tanlaydi                                             | User tugma orqali pool tanlaydi (Normal/Adult)               |

### Tushuncha aniqligi

- **PRIVATE Online** = "do'stlarim bilan o'ynayman, lekin turli joylardamiz, chat + auto-phase kerak". UX: Friends formasi bilan deyarli bir xil, faqat link share qilinadi va chat/auto-phase yoqilgan.
- **PUBLIC Online** = "kim bilandir o'ynayman". Bitta tugma — find-or-create. Mos lobby topilsa qo'shiladi, topilmasa yangi yaratiladi va shu user creator bo'ladi. Boshqalar matchmake bilan keyin qo'shilib boradi.

### Backend nuqtai nazaridan

Ikkala online sub-rejim **bir xil service** ishlatadi (`OnlineBunkerGameService` / `OnlineMafiaGameService`). Yagona farq — `Room.visibility` field:

- `PRIVATE` — matchmake qidiruvida ko'rinmaydi, faqat kod orqali
- `PUBLIC` — matchmake qidiruvida ko'rinadi (LOBBY status, joy bor, isAdult mos)

Schema'ga additive field qo'shamiz.

---

## 3. Auto-Composition formulasi

### Bunker (Online)

| O'yinchilar | winnerTarget |
| ----------- | ------------ |
| 3–5         | 2            |
| 6–10        | 3            |
| 11–16       | 4            |

User faqat **Normal / 18+** tanlaydi. `winnerTarget` va `maxPlayers` (har doim 16) tizim tomonidan.

### Mafia (Online)

| O'yinchilar | mafiaCount | hasSheriff | hasDoctor |
| ----------- | ---------- | ---------- | --------- |
| 4–6         | 1          | ✅         | ❌        |
| 7–10        | 2          | ✅         | ✅        |
| 11–15       | 3          | ✅         | ✅        |

User **hech narsa tanlamaydi**. Lobby to'lganda yoki o'yin boshlanganda tizim o'zi composition aniqlaydi.

---

## 4. Arxitektura strategiyasi — qachon shared, qachon alohida

### 4.1 Shared (ikkala rejim ishlatadi)

Faqat **stateless presentational** UI atomlari. Hech qanday socket, hech qanday API call, hech qanday store. Faqat props → JSX.

Misollar:
- `<PlayerCard player={...} onClick={...} />` — avatar, nick, tirik/o'lik holat, online dot
- `<Timer endsAt={...} variant="..." />` — allaqachon mavjud (`apps/web/components/timer.tsx`)
- `<VoteButton candidate={...} selected={...} />` — bitta nominee tugmasi
- `<RoleRevealModal role={...} onConfirm={...} />` — Mafia rol ochish modal
- `<CardRevealAnimation card={...} />` — Bunker karta ochish animatsiyasi
- `<DisasterBanner disaster={...} />` — Bunker disaster banner

### 4.2 Mode-specific (faqat o'zining rejimi ishlatadi)

State, socket connection, faza navigatsiyasi, host action'lar — har rejim **o'z** `experience.tsx`'ida. Online'ning host-controls'i yo'q, auto-advance bor, chat bor. Friends'ning host-controls'i bor, chat'i yo'q. Bularni shared qilishga urinish kodni murakkablashtiradi va izolyatsiyani buzadi.

### 4.3 Backend strategiyasi — composition, NOT inheritance

`OnlineBunkerGameService` `BunkerGameService`'ni **extends qilmaydi**. Yangi service mavjud servisning instance'ini private property sifatida ushlab turadi (`this.base`) va kerak bo'lgan public metodlarini chaqiradi (`createRoom`, `joinRoom`, `getRoomState`...). Online-only metodlar (`autoAdvance`, `computeComposition`) yangi service'da yashaydi.

Sababi:
- Inheritance bilan base'dagi `private` metodlarga kirish mumkin emas
- Inheritance bilan base'ni o'zgartirsangiz subclass kutilmagan tarzda sinadi
- Composition bilan base service'ga **0 ta o'zgartirish** kiradi

```typescript
// online-bunker-game-service.ts (skeleton)
export class OnlineBunkerGameService {
  constructor(private readonly base: BunkerGameService) {}

  setRealtime(publisher: RealtimePublisher) {
    // Base allaqachon registry tomonidan setRealtime qilingan — qayta kerak emas.
    // Lekin bu service'ning o'z timer/auto-advance broadcast'lari uchun
    // o'z publisher referencesini saqlaydi.
    this.publisher = publisher;
  }

  async createRoom(input: OnlineCreateInput) {
    const winnerTarget = this.computeWinnerTarget(/* maxPlayers default 16 */);
    return this.base.createRoom({
      ...input,
      mode: "ONLINE",       // ← schema'ga qo'shilgan field
      winnerTarget,
      maxPlayers: 16,
    });
  }

  async startGameAuto(roomCode: string) {
    // Host check'siz — tizim chaqiradi.
    // Base'ning startGame'i hostSessionId tekshiradi, shuning uchun
    // bu metod alohida path bo'ladi (qoldagi karta tarqatish logikasini
    // base'dan helper sifatida chaqiradi yoki o'zi qiladi).
  }

  async autoAdvance(roomCode: string) {
    // Faza tugaganda chaqiriladi (timer expire yoki "yakunlash"):
    // ROUND_REVEAL → ROUND_PITCH → ROUND_COMPLETE → VOTING → keyingi round
  }

  private computeWinnerTarget(playerCount: number): number {
    if (playerCount <= 5) return 2;
    if (playerCount <= 10) return 3;
    return 4;
  }
}
```

> [!IMPORTANT]
> Agar online service'da base'ning **private** metodi (masalan `beginNextRound`, `resolveVoting`) ishlatish kerak bo'lsa, ikki variant bor:
> 1. Base'da o'sha metodni `private` → `internal` (yangi `/** @internal */` markirovkasi bilan `public`) qilish — bu **o'zgartirish**, lekin minimal va xavfsiz.
> 2. Online service'da o'sha logikani **qayta yozish** — kod takrori, lekin to'liq izolyatsiya.
>
> Tavsiya: avval (2)ni urinib ko'rish, kod takrori 50 qatordan ko'p bo'lsa (1)ga o'tish. Karor implementation paytida olinadi.

---

## 5. Tab UI — Create sahifalarida

### 5.1 Hozirgi holat

[apps/web/components/games/bunker/bunker-create-page.tsx](apps/web/components/games/bunker/bunker-create-page.tsx) (330 qator) va [apps/web/components/games/mafia/mafia-create-page.tsx](apps/web/components/games/mafia/mafia-create-page.tsx) (361 qator) — har biri o'z forma'sini render qiladi.

### 5.2 Yangi tuzilma — ikki darajali tab

Har create page'da:

1. **Eng tepada 2 ta asosiy tab**: `Do'stlar davrasi | Online`
2. **Online tab ichida** yana 2 ta sub-tab: `Private lobby | Public lobby`
3. Har sub-tab o'z formasini render qiladi.

URL: `?mode=online&sub=public` deep-link qo'llab-quvvatlanadi.

```
┌─────────────────────────────────────┐
│  ┌─────────────┬─────────────────┐  │  ← asosiy tab
│  │  Do'stlar   │   ✓ Online      │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│  Online haqida qisqa info           │
│  (chat + auto-phase, matchmaking)   │
├─────────────────────────────────────┤
│  ┌─────────────┬─────────────────┐  │  ← sub-tab
│  │ ✓ Private   │     Public      │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│  [Sub-tab kontenti]                 │
└─────────────────────────────────────┘
```

### 5.3 Bunker create page — to'liq yo'l xaritasi

**Friends tab** (mavjud, tegmaslik): hozirgi `BunkerCreatePage` JSX `<BunkerFriendsCreate />`'ga ekstrakt qilinadi.

**Online → Private sub-tab**:
- Forma: nickname + winnerTarget (1/2/3) + "Normal | 18+" toggle
- Tugma: `[Private lobby yaratish]` → POST `/api/rooms/create` (mode=ONLINE, visibility=PRIVATE) → /room/CODE (kod share qilinadi)

**Online → Public sub-tab**:
- **Sozlamalar yo'q**, faqat 2 tugma:
  - `[🌐 Public qo'shilish — Normal]` → POST `/api/rooms/matchmake` (gameType=BUNKER, isAdult=false)
  - `[🌐 Public qo'shilish — 18+]` → POST `/api/rooms/matchmake` (gameType=BUNKER, isAdult=true)
- Server: mos LOBBY topsa qo'shadi, topmasa yangi yaratadi (default settings bilan, composition keyin auto-compute) — har ikkalasida `/room/CODE` ga redirect.

### 5.4 Mafia create page — to'liq yo'l xaritasi

**Friends tab** (mavjud, tegmaslik): hozirgi forma (mafiaCount + sheriff + doctor).

**Online → Private sub-tab**:
- Forma: nickname + mafiaCount + hasSheriff + hasDoctor (xuddi Friends kabi)
- Tugma: `[Private lobby yaratish]`

**Online → Public sub-tab**:
- **Sozlamalar yo'q**, faqat bitta tugma: `[🌐 Public qo'shilish]` → POST `/api/rooms/matchmake` (gameType=MAFIA)
- Server: mos LOBBY topsa qo'shadi, topmasa yangi yaratadi (composition o'yin boshlanganda auto-compute Section 3 formulasi bilan).

> [!NOTE]
> **3 ta kirish nuqtasi har o'yinda** (user javobiga mos):
> 1. Friends create (mavjud, tegmaslik)
> 2. Online Private create (custom settings bilan, kod share)
> 3. Online Public — find-or-create (sozlamasiz, matchmake)
>
> Bunker'da Public 2 ta tugma (Normal/Adult), Mafia'da bitta tugma.

```
┌─────────────────────────────────────┐
│  ← Orqaga              BUNKER       │
├─────────────────────────────────────┤
│  ┌─────────────┬─────────────────┐  │  ← yangi TabBar
│  │ ✓ Do'stlar  │     Online      │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│  [Banner rasmi]                     │
│  ...                                │
│  Friends qoidalari (mavjud kontent) │
│  ...                                │
│  [Hosting form (mavjud)]            │
└─────────────────────────────────────┘
```

**Bunker — Online → Private** (yaratish, kod bilan share):
```
┌─────────────────────────────────────┐
│  ← Orqaga              BUNKER       │
├─────────────────────────────────────┤
│  ┌─────────────┬─────────────────┐  │
│  │  Do'stlar   │   ✓ Online      │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│  Online — chat + avtomatik fazalar  │
├─────────────────────────────────────┤
│  ┌─────────────┬─────────────────┐  │
│  │ ✓ Private   │     Public      │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│  NICKNAME                           │
│  [Alisher____________]              │
│  G'OLIB MIQDORI                     │
│  [1] [2] [3]                        │
│  MAVZU                              │
│  [Normal] [18+]                     │
│                                     │
│  [🔒 Private lobby yaratish]        │
└─────────────────────────────────────┘
```

**Bunker — Online → Public** (find-or-create):
```
┌─────────────────────────────────────┐
│  ← Orqaga              BUNKER       │
├─────────────────────────────────────┤
│  ┌─────────────┬─────────────────┐  │
│  │  Do'stlar   │   ✓ Online      │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│  ┌─────────────┬─────────────────┐  │
│  │   Private   │   ✓ Public      │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│  Public — kim bilandir o'ynash.     │
│  Bo'sh lobby topilsa qo'shilasiz,   │
│  yo'q bo'lsa siz creator bo'lasiz.  │
├─────────────────────────────────────┤
│  NICKNAME                           │
│  [Alisher____________]              │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🌐 Public — Normal         │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  🌐 Public — 18+            │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Mafia — Online → Public** (sozlamasiz, bitta tugma):
```
┌─────────────────────────────────────┐
│  ┌─────────────┬─────────────────┐  │
│  │   Private   │   ✓ Public      │  │
│  └─────────────┴─────────────────┘  │
├─────────────────────────────────────┤
│  Public — kim bilandir o'ynash.     │
├─────────────────────────────────────┤
│  NICKNAME                           │
│  [Alisher____________]              │
│                                     │
│  [🌐 Public qo'shilish]             │
└─────────────────────────────────────┘
```

### 5.3 Implementation strategiyasi (eng muhim)

`bunker-create-page.tsx` ichida **Friends kontentini** ZARRA ham o'zgartirmaslik uchun:

1. Mavjud `BunkerCreatePage` komponentidagi barcha JSX **o'zgarishsiz** `<BunkerFriendsCreate />` deb nomlangan ichki komponentga o'raladi (faqat ekstrakt — diff = 0 effective).
2. Yangi `<BunkerOnlineCreate />` komponenti `apps/web/components/games/online-bunker/online-bunker-create.tsx`'da yoziladi.
3. `BunkerCreatePage` endi qisqa shell bo'ladi:

```tsx
export function BunkerCreatePage() {
  const [mode, setMode] = useTabMode(); // local + URL sync
  return (
    <TelegramChrome>
      <CreatePageTabs value={mode} onChange={setMode} />
      {mode === "friends" ? <BunkerFriendsCreate /> : <BunkerOnlineCreate />}
    </TelegramChrome>
  );
}
```

> [!IMPORTANT]
> "Mavjud Friends kontentini hech narsasiga tegmaslik" qoidasi bu yerda **JSX'ning ichki tuzilmasi va class'lariga** tegishli. Komponentni yangi ism bilan o'rab qo'yish — qayta render natijasini o'zgartirmaydi. Bu ekstraksiya `git diff`'da JSX bloklari aynan o'zgarmaganini ko'rsatadi.

Mafia uchun ham xuddi shunday: `<MafiaFriendsCreate />` + `<MafiaOnlineCreate />`.

---

## 5.5 Online lobby xulq-atvori (yangi — Friends'dan butunlay farq)

Bu logika faqat ONLINE rejimda. Friends'da hech nima o'zgarmaydi.

### Start trigger — ikki yo'l (har qaysisi yetadi)

1. **Creator manual start**: lobby'da min'ga yetganda creator `[Boshlash]` tugmasini ko'radi va bosadi.
2. **Hamma tayyor**: har o'yinchida `[Tayyorman]` tugmasi (toggle). Min'ga yetilgan VA barcha o'yinchilar `Tayyorman` belgilagan bo'lsa — tizim **avtomatik** boshlaydi.

> Timeout YO'Q. Lobby'ni tark etish/kirish doim ochiq.

### Tayyorman tugmasi xulq-atvori

- **Disabled** — agar lobby min'ga yetmagan bo'lsa. Yonida yozuv: `Yana N o'yinchi kerak`.
- **Enabled** — min'ga yetganda. User bossa state `readyAt = now()`, qayta bossa toggle off (`readyAt = null`).
- Boshqa o'yinchilarning ready state'i ham PlayerCard'da ko'rinadi (yashil checkmark / dot).
- Min'ga yetdi VA `players.every(p => p.readyAt !== null)` → tizim auto-start.

### Creator power'lari

- `[Boshlash]` — min'ga yetganda
- `[Kick]` — har bir o'yinchi yonida (mavjud Friends pattern)
- Lobby sozlamalarini **lock** qiladi (start bosguncha)

### Host transfer (creator chiqib ketsa)

Creator socket disconnect bo'lib **5 daqiqa** ichida qaytmasa yoki manual leave qilsa:

1. Lobby'dagi qolgan o'yinchilardan **eng erta qo'shilgan** (joinedAt eng kichik) yangi creator sifatida tanlanadi.
2. Yangi creator'ga real-time event (`creator_changed`) yuboriladi → UI'da `[Boshlash]` va `[Kick]` tugmalari ko'rinadi.
3. Eski creator qaytsa, oddiy o'yinchi sifatida qoladi (creator role qaytarilmaydi).
4. Agar lobby bo'sh qolsa — `Room.status = CANCELLED`.

> [!IMPORTANT]
> Host transfer **faqat lobby'da** ishlaydi. O'yin boshlangach (status = PLAYING) creator role muhim emas, chunki tizim fazalarni boshqaradi.

### "Tayyorman" state schema

Bu state Player modeliga additive field sifatida qo'shiladi: `Player.readyAt: DateTime?` (null = tayyor emas, qiymat = qachon belgilagan). Game start bo'lganda bu field reset qilinmaydi (faqat lobby'da ma'noli).

### Public matchmake adult/normal pool

Bunker matchmake qidiruvi **strict adult filter** bilan:
- User `[Public — Normal]` bossa: `WHERE visibility=PUBLIC AND status=LOBBY AND isAdult=false AND playerCount<maxPlayers AND mode=ONLINE AND gameType=BUNKER`
- User `[Public — 18+]` bossa: `WHERE ... AND isAdult=true ...`

Mafia uchun adult yo'q — bitta pool (`gameType=MAFIA`).

### "1 user = 1 active room" qoidasi (N3)

Matchmake yoki create endpoint'larida har so'rovdan oldin tekshirish:

```typescript
// Pseudo-code
const activeRoom = await prisma.player.findFirst({
  where: {
    userId,
    room: { status: { in: ["LOBBY", "PLAYING"] } }
  },
  include: { room: true }
});

if (activeRoom) {
  // matchmake/create chaqiruvi `confirmLeaveExisting: true` parametri bilan
  // qaytadan kelmaguncha — 409 Conflict + activeRoom info qaytariladi.
  // Frontend modal ko'rsatadi (N4).
  return reply.status(409).send({
    code: "ACTIVE_ROOM_EXISTS",
    activeRoom: { code, gameType, status, mode }
  });
}
```

Frontend modal:
```
┌─────────────────────────────────────┐
│  Sizning aktiv o'yiningiz bor       │
│  BUNKER · LOBBY · 4/10              │
│                                     │
│  [Davom etish]  [Yangi o'yin]       │
└─────────────────────────────────────┘
```

`Yangi o'yin` bossa — frontend avval `POST /api/rooms/:code/leave` (mavjud endpoint), keyin matchmake/create qayta chaqiriladi (`confirmLeaveExisting: true` bilan).

---

## 6. Yangi reusable shared komponentlar (kerak bo'lsa)

Bu komponentlar **online'ni yozayotganda** kerak bo'lsa ajratiladi — oldindan emas. Ya'ni:

1. Avval `online-bunker-experience.tsx` yozish boshlanadi.
2. Friends'dagi qaysi UI bloki kerak bo'lsa — o'sha blok shared'ga ekstrakt qilinadi.
3. Friends-experience'da o'sha bloki `<SharedAtom />` chaqiruviga almashtiriladi (faqat shu blok — qolgan kod tegmaydi).
4. Online-experience ham shu `<SharedAtom />`'ni ishlatadi.

Potentsial nomzodlar (online yozish jarayonida tasdiqlanadi):

| Shared atom              | Hozir qayerda                                   | Asoslanish                                                        |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------- |
| `<PlayerListItem />`     | bunker-experience, mafia-experience             | Lobby'da o'yinchilar ro'yxati ikkala rejim uchun bir xil ko'rinish |
| `<DisasterBanner />`     | bunker-experience (`disasterImage` map)         | Bunker disaster modal — ikkala rejim ko'rsatadi                   |
| `<RoleRevealCard />`     | mafia-role-reveal.tsx                           | Mafia rol ochish — ikkala rejim ko'rsatadi                        |
| `<NightActionPicker />`  | mafia-night.tsx                                 | Mafia tunda harakat tanlash UI'si                                 |
| `<DayVotePanel />`       | mafia-day.tsx                                   | Kun ovozi UI                                                      |
| `<BunkerCardRevealModal />` | bunker-experience                            | Karta ochish modal                                                |

> Bu jadval **plan**, qat'iy ro'yxat emas. Implementation paytida har bir nomzod alohida baholaniladi: agar Friends va Online versiyasi 80%+ bir xil bo'lsa — ekstrakt qilinadi. Bo'lmasa — ikkala rejim alohida render qiladi.

> [!IMPORTANT]
> Agar shared atom Friends'dagi mavjud kodni **ekstrakt** qilish orqali yaratilsa, bu Friends faylini **tegmaslik** qoidasini buzadi. Shu sababli bu yerda toza kelishuv kerak: ekstraksiya — JSX'ni boshqa fayldan import qilish, lekin **render natijasini o'zgartirmaslik**. Visual regression test (yoki manual smoke test) Friends'da farq yo'qligini tasdiqlaydi. Agar shubha bo'lsa — ekstraksiya qilinmaydi, online o'z nusxasini yozadi.

---

## 7. Backend — fayllar ro'yxati

### 7.1 Yangi fayllar

| #   | Fayl                                                                     | Vazifasi                                                |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| B1  | `apps/api/src/games/online/online-bunker-game-service.ts`                | Composition wrapper: createRoom + auto-advance + auto-composition |
| B2  | `apps/api/src/games/online/online-mafia-game-service.ts`                 | Composition wrapper: shu kabi                           |
| B3  | `apps/api/src/games/online/online-lobby-manager.ts`                      | Lobby countdown + auto-start (ikkala o'yin uchun umumiy) |
| B4  | `apps/api/src/services/matchmaking-service.ts`                           | Ochiq LOBBY topish yoki yangi room yaratish             |
| B5  | `apps/api/src/services/chat-service.ts`                                  | In-memory Map: roomCode → ChatMessage[]                 |

### 7.2 Mavjud fayllarga MINIMAL qo'shimcha (faqat additive)

| #   | Fayl                                                                                                | Nima qo'shiladi                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B6  | [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)                                      | (a) `RoomMode` enum + `Room.mode` field — **allaqachon qilingan** (commit 743685f). (b) **Yangi qo'shimchalar**: `RoomVisibility` enum (`PUBLIC \| PRIVATE`) + `Room.visibility` field, default `PRIVATE`. (c) `Player.readyAt: DateTime?` field (online lobby "Tayyorman" uchun). `Player.joinedAt` allaqachon mavjud (host transfer order uchun ishlatamiz). |
| B7  | [apps/api/src/games/registry.ts](apps/api/src/games/registry.ts)                                    | `onlineBunker`, `onlineMafia` instance + `forOnline(gameType)` dispatch + setRealtime'ga ulash. Mavjud `bunker`/`mafia` qatorlariga tegmaslik.                                                                                                                            |
| B8  | [apps/api/src/routes/public-routes.ts](apps/api/src/routes/public-routes.ts)                        | (a) `/api/rooms/create` body'ga `mode: "FRIENDS" \| "ONLINE"` va `visibility: "PUBLIC" \| "PRIVATE"` qo'shish — default `FRIENDS`/`PRIVATE`, eski clientlar avvalgidek ishlaydi. (b) `mode === "ONLINE"` bo'lsa `games.forOnline(gameType).createRoom(...)` chaqirish, `visibility` ham uzatiladi. (c) Yangi `POST /api/rooms/matchmake` endpoint — faqat `mode=ONLINE && visibility=PUBLIC && status=LOBBY` ro'yxatdan tanlaydi. (d) `/api/rooms/:code/info` response'ga `mode` va `visibility` field qo'shish. |
| B9  | [apps/api/src/socket/realtime-hub.ts](apps/api/src/socket/realtime-hub.ts)                          | (a) `send_chat_message` event handler. (b) `online:bunker:end_pitch` event. (c) `online:start_game` event (creator lobby'da boshlash). (d) `online:toggle_ready` event (Tayyorman). (e) `creator_changed` broadcast (host transfer). Mavjud handler'larga tegmaslik. |

### 7.3 Backend fayllariga TEGMASLIK

- [apps/api/src/games/bunker/bunker-game-service.ts](apps/api/src/games/bunker/bunker-game-service.ts) (1754 qator) — **0 o'zgarish**
- [apps/api/src/games/bunker/bunker-types.ts](apps/api/src/games/bunker/bunker-types.ts) — **0 o'zgarish**
- [apps/api/src/games/mafia/mafia-game-service.ts](apps/api/src/games/mafia/mafia-game-service.ts) (1588 qator) — **0 o'zgarish**
- [apps/api/src/games/mafia/mafia-types.ts](apps/api/src/games/mafia/mafia-types.ts) — **0 o'zgarish**

> Yagona istisno: agar implementation paytida private metod kerak bo'lsa — uni `public` qilish (bo'limga 4'dagi izohga qarang).

---

## 8. Frontend — fayllar ro'yxati

### 8.1 Yangi fayllar

| #   | Fayl                                                                          | Vazifasi                                                       |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| F1  | `apps/web/components/games/shared/create-page-tabs.tsx`                       | Tab UI atom (Friends / Online switcher)                        |
| F2  | `apps/web/components/games/shared/use-tab-mode.ts`                            | Hook: tab mode + URL `?mode=` sync                             |
| F3  | `apps/web/components/games/bunker/bunker-friends-create.tsx`                  | Hozirgi `BunkerCreatePage`'dagi JSX'ni **aynan ko'chirma**     |
| F4  | `apps/web/components/games/mafia/mafia-friends-create.tsx`                    | Hozirgi `MafiaCreatePage`'dagi JSX'ni **aynan ko'chirma**      |
| F5  | `apps/web/components/games/online-bunker/online-bunker-create.tsx`            | Online tab kontenti: minimal forma + qoidalar + matchmake call |
| F6  | `apps/web/components/games/online-bunker/online-bunker-experience.tsx`        | Game UI — host controls yo'q, chat bor, auto-phase             |
| F7  | `apps/web/components/games/online-bunker/online-bunker-types.ts`              | Online-only state qo'shimchalari (chat, mode)                  |
| F8  | `apps/web/components/games/online-mafia/online-mafia-create.tsx`              | Online tab kontenti: faqat nickname + matchmake call           |
| F9  | `apps/web/components/games/online-mafia/online-mafia-experience.tsx`          | Game UI — host controls yo'q, chat bor, auto-phase             |
| F10 | `apps/web/components/games/online-mafia/online-mafia-types.ts`                | Online-only state qo'shimchalari                               |
| F11 | `apps/web/components/games/shared/game-chat.tsx`                              | Chat UI — compact bottom bar + expanded bottom sheet           |
| F12 | `apps/web/store/use-chat-store.ts`                                            | Zustand: messages[], unreadCount                               |
| F13 | `apps/web/hooks/use-speech-to-text.ts`                                        | (Phase 2) Web Speech API hook                                  |
| F19 | `apps/web/components/games/online-bunker/online-bunker-lobby-ready.tsx`       | "Tayyorman" tugmasi + creator [Boshlash] tugmasi               |
| F20 | `apps/web/components/games/online-mafia/online-mafia-lobby-ready.tsx`         | Shu kabi                                                        |
| F21 | `apps/web/components/dashboard/active-game-banner.tsx`                        | "Davom etish" banner — user aktiv online room'i bo'lsa dashboard tepasida ko'rinadi |
| B10 | `apps/api/src/services/host-transfer-service.ts`                              | Creator chiqib ketsa eng erta `joinedAt` o'yinchiga creator role o'tkazish (5 daqiqa grace) |

### 8.2 Mavjud fayllarga MINIMAL qo'shimcha

| #   | Fayl                                                                                              | O'zgarish                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F14 | [apps/web/components/games/bunker/bunker-create-page.tsx](apps/web/components/games/bunker/bunker-create-page.tsx) | Mavjud JSX'ni `<BunkerFriendsCreate />` ga ekstrakt qilish. Yangi shell: `<TabBar /> + (mode==="friends" ? <Friends/> : <Online/>)`. Hech qanday ichki logikani o'zgartirmaslik. |
| F15 | [apps/web/components/games/mafia/mafia-create-page.tsx](apps/web/components/games/mafia/mafia-create-page.tsx)     | Shu kabi.                                                                                                                                                                                                                                  |
| F16 | [apps/web/components/games/game-router.tsx](apps/web/components/games/game-router.tsx)            | (a) `RoomInfo`'ga `mode: RoomMode` field. (b) Switch'da `info.mode === "ONLINE"` bo'lsa Online experience'ga dispatch.                                                                                                                     |
| F17 | [apps/web/lib/types.ts](apps/web/lib/types.ts)                                                    | `RoomMode` type qo'shish (additive).                                                                                                                                                                                                       |
| F18 | `apps/web/messages/{uz,ru,en}.json`                                                               | Online uchun yangi tarjima kalitlari (additive).                                                                                                                                                                                           |

### 8.3 Frontend fayllariga TEGMASLIK

- [apps/web/components/games/bunker/bunker-experience.tsx](apps/web/components/games/bunker/bunker-experience.tsx) (1909 qator) — **0 o'zgarish**
- [apps/web/components/games/bunker/bunker-host-controls.tsx](apps/web/components/games/bunker/bunker-host-controls.tsx) — **0 o'zgarish**
- [apps/web/components/games/bunker/bunker-player-card.tsx](apps/web/components/games/bunker/bunker-player-card.tsx) — **0 o'zgarish**
- [apps/web/components/games/bunker/bunker-vote-panel.tsx](apps/web/components/games/bunker/bunker-vote-panel.tsx) — **0 o'zgarish**
- [apps/web/components/games/mafia/mafia-experience.tsx](apps/web/components/games/mafia/mafia-experience.tsx) (1925 qator) — **0 o'zgarish**
- [apps/web/components/games/mafia/mafia-day.tsx](apps/web/components/games/mafia/mafia-day.tsx) — **0 o'zgarish**
- [apps/web/components/games/mafia/mafia-night.tsx](apps/web/components/games/mafia/mafia-night.tsx) — **0 o'zgarish**
- [apps/web/components/games/mafia/mafia-role-reveal.tsx](apps/web/components/games/mafia/mafia-role-reveal.tsx) — **0 o'zgarish**
- (qolgan barcha mafia/* va shared/*) — **0 o'zgarish**

> Istisno: 6-bo'limdagi reusable atom ekstraksiyasi qilinsa, faqat **bitta JSX bloki bitta import'ga almashinadi**, qolgani tegmaydi. Har bunday almashtirish PR'da alohida ko'rinadi va ko'z bilan tasdiqlash mumkin.

---

## 9. Bosqichma-bosqich rollout

Bir martada hammasini qilmaslik. Har bosqich alohida PR sifatida ship qilinadi va Friends'ning regressiyasi bo'lmasligi tekshiriladi.

### Bosqich 0 — Tozalash (1 commit)

- Bo'sh `apps/api/src/games/online/`, `apps/web/app/games/bunker/online/`, `apps/web/app/games/mafia/online/` papkalarini o'chirish.
- `apps/web/package.json` dependency qo'shimchalarini qaytarish (yoki keyin kerak bo'lganlarini saqlab qolish — `clsx` foydali).
- `RoomMode` enum saqlanadi (kerak bo'ladi).

### Bosqich 1 — Create page tabs (no behavior change)

- F1, F2, F3, F4, F14, F15 yaratish/o'zgartirish.
- Online tab kontenti: faqat "tez orada" placeholder.
- **Tasdiqlash**: Friends tab'i avvalgidek ishlaydi. Bunker create → room → game. Mafia ham shunday.

### Bosqich 2 — Backend: matchmaking + online services skeleton

- B1, B2, B3, B4, B7, B8 (a/b/c/d) yaratish/o'zgartirish.
- Online services dastlab faqat `createRoom` va `joinRoom`'ni base'ga delegate qiladi. Auto-advance hali yo'q.
- **Tasdiqlash**: `POST /api/rooms/matchmake` ishlaydi. Curl bilan room yaratish/topish testlanadi.

### Bosqich 3 — Online experience (host-controls'siz, chat'siz)

- F5, F6, F7, F8, F9, F10, F16, F17, F18 yaratish.
- Online experience host controls'siz — lekin lobby'dan game'ga avtomatik o'tish hali yo'q (debug uchun creator manual "boshlash").
- **Tasdiqlash**: Online tab → matchmake → lobby → creator boshlaydi → game ishlaydi. Friends regressiyasi yo'q.

### Bosqich 4 — Lobby xulq-atvori (Tayyorman + host transfer) + faza auto-advance

- B3 to'liq logikasi: faza timer'lari tugaganda auto-advance.
- Online services'ga `autoAdvance` metod implementatsiyasi.
- "Tayyorman" tugmasi (F19, F20) + `online:toggle_ready` event (B9d).
- Host transfer service (B10) + `creator_changed` event (B9e).
- Reconnect "Davom etish" banner (F21).
- **Tasdiqlash**:
  - Lobby min'ga yetib hamma `[Tayyorman]` belgilasa auto-start.
  - Creator chiqsa, 5 daqiqa ichida qaytmasa, eng erta o'yinchiga creator transfer.
  - User browser yopib qaytsa, dashboard'da `[Davom etish]` banner ko'rinadi.
  - Pitch timer tugaganda keyingi o'yinchiga o'tish.

### Bosqich 5 — Chat

- F11, F12, B5, B9 (a) yaratish.
- Chat compact bottom bar + expanded sheet.
- **Tasdiqlash**: 3 ta tab ochib xabar yuborish, real-time ko'rinishi.

### Bosqich 6 (optional) — STT

- F13 + chat input'ga mic tugmasi.

### Bosqich 7 (optional) — Reusable atom ekstraksiyasi

- Faqat agar Friends va Online o'rtasida aniq kod takrori bo'lsa.
- Har atom alohida commit/PR. Visual regression tasdiqlash.

---

## 10. Hal qilingan & ochiq savollar

### Hal qilingan

> [!NOTE]
> **Q4 (Pitch chat) — HAL**: Bunker pitch fazasida hamma har doim yozadi, joriy o'yinchining xabarlari UI'da highlighted (boshqa rangli border / accent). Boshqalar muhokama qilishi mumkin, lekin "navbat kimda" aniq ko'rinadi. ✅

> [!NOTE]
> **Q5 (Chat persistence) — HAL**: Redis ishlatamiz. Pattern [auth-session-store.ts](apps/api/src/services/auth-session-store.ts)'dagi kabi (`getRedis()` + TTL).
>
> **Aniq texnik tanlov**:
> - Storage: **Redis List** (`LPUSH`/`LRANGE`) — chat tabiati append-only, oldingi N xabarni tezda olish kerak. Hash'dan ko'ra tabiyroq, Streams'dan sodda.
> - Key: `chat:{roomCode}` (masalan `chat:ABC123`)
> - TTL: **6 soat** — Bunker/Mafia room'lari maksimal umri shu atrofida. Cleanup sweeper room'ni o'chirganda chat key ham `DEL` qilinadi.
> - Cap: har room'da maksimal **500 xabar** (ikki yo'l: `LPUSH` keyin `LTRIM 0 499`). Spam himoyasi.
> - Xabar shape: JSON-stringified `{ id, senderId, senderName, text, timestamp }`.
> - Reconnect: yangi qo'shilgan o'yinchi `LRANGE chat:{code} 0 99` orqali so'nggi 100 xabarni oladi (oldest-first qaytariladi: `LRANGE` natijasi `reverse()` qilinadi yoki `RPUSH` ishlatiladi — tanlov implementation paytida).
> - Rate limit: bitta o'yinchi sekundiga 2 xabar (in-memory token bucket per `senderId`). Buni keyinroq qo'shish mumkin.
>
> **Implementation**: yangi [`apps/api/src/services/chat-service.ts`](apps/api/src/services/chat-service.ts) ichida `appendMessage(roomCode, msg)`, `getRecentMessages(roomCode, limit)`, `clearRoom(roomCode)` metodlari. Mavjud `getRedis()` helper'ni import qiladi — yangi connection logic kerak emas.

### Hal qilingan savollar

> [!NOTE]
> **Q1**: Public matchmake adult-aware. Normal va Adult pool alohida. ✅
>
> **Q2**: Public matchmake bo'sh lobby topmasa, yangi room avtomatik yaratiladi, matchmake qilgan user creator bo'ladi. **Public uchun alohida "yaratish" formasi yo'q** — bitta tugma find-or-create qiladi. ✅
>
> **Q3**: Lobby timeout YO'Q. Trigger: creator `[Boshlash]` YOKI hamma `[Tayyorman]` → auto-start. Creator chiqsa — host transfer eng erta `joinedAt` o'yinchiga. ✅
>
> **Q4**: Public matchmake avtomatik bitta lobby'ga qo'shadi (list yo'q). ✅
>
> **Q5/Q6**: Nickname avto-prefill, tahrirlanadigan. UI tabs nested. ✅
>
> **Q7**: Dashboard'da `[Davom etish]` banner. ✅
>
> **N1**: `[Tayyorman]` tugmasi min'ga yetmaguncha **disabled**, yonida `Yana N o'yinchi kerak` yozuvi. Min'ga yetganda enable bo'ladi. ✅
>
> **N2**: Creator disconnect — **5 daqiqa grace** (mobil tarmoq uzilishi va telegram-app suspend stsenariylariga moslashgan), keyin transfer. Manual leave — darhol transfer. ✅
>
> **N3**: 1 user = 1 active room (har qanday rejim — friends/online private/public). DB constraint: user'ning `status IN (LOBBY, PLAYING)` room'i 0 yoki 1 ta. ✅
>
> **N4**: Modal `[Davom etish]` / `[Yangi o'yin boshlash]`. Yangi tanlasa, eski'dan chiqarib yangi'ga qo'shadi. ✅
>
> **N5**: Public lobby'ga kirayotgan user'ga sozlamalar ko'rinadi (`Bunker · Normal · 3 g'olib · 5/10`). ✅
>
> **N6**: `[Tayyorman]` PlayerCard yonida, ready state boshqalarga ham ko'rinadi (yashil dot/checkmark). ✅

---

## 11. Verification plan

### Build & lint

```bash
cd apps/api && npx prisma db push
yarn build
yarn lint
```

### Friends regressiyasi (har bosqichdan keyin)

- [ ] Bunker: create → lobby → start → reveal → pitch → vote → finish — avvalgidek
- [ ] Mafia: create → lobby → role reveal → night → day → result → finish — avvalgidek
- [ ] Hech qanday vizual yoki funksional farq yo'q

### Online Bunker

- [ ] Tab "Online" → faqat nickname + Normal/18+ ko'rinadi
- [ ] "O'yinga qo'shilish" → matchmake → lobby
- [ ] 2 daqiqa countdown → auto-start (yoki creator tugma)
- [ ] Game: host controls yo'q, fazalar avtomatik o'tadi
- [ ] Chat: xabar yuborish, ko'rish, real-time

### Online Mafia

- [ ] Tab "Online" → faqat nickname ko'rinadi
- [ ] Matchmake → lobby → auto-start
- [ ] Composition odam soniga qarab avtomatik
- [ ] Night/day avtomatik o'tish
- [ ] Chat ishlaydi

---

## 12. Final fayllar ro'yxati

**Yangi (13 ta):**
B1, B2, B3, B4, B5, F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12, F13

**Modified — additive only (8 ta):**
B7, B8, B9, F14, F15, F16, F17, F18

**Tegmaslik (~20 ta):**
Barcha mavjud bunker/, mafia/ service va component fayllari.

---

## Xulosa: Eski reja vs yangi reja

| Jihat                   | Eski (v1)                                         | Yangi (v2)                                                  |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Online uchun create UI  | `/dashboard/create/online-bunker` (yangi route)   | Mavjud `/dashboard/create/bunker`'da **tab**                |
| Friends bilan birlashma | Hech qanday — alohida route                       | Bitta page, ikki tab (UX yaxshiroq, kashf qilish oson)      |
| Backend service        | Inheritance/extend + extra qatorlar                | Composition wrapper + base service'ga 0 ta o'zgarish        |
| Reusable strategy       | Oldindan rejalashtirilgan                         | Online'ni yozayotganda kerak bo'lganda ekstrakt             |
| Chat                    | Bosqich 1'da                                      | Bosqich 5'da (online avval ishlasin)                        |
| Bosqichlar              | Hammasi bir martada                               | 6 bosqich, har biri alohida PR + regression test            |
