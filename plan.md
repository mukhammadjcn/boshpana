# 🧠 BUNKER ONLINE — FULLSTACK TECH SPEC (MVP)

## 🎯 PROJECT OVERVIEW

Bunker Online — multiplayer, real-time party game.
Players join via phone and play together physically in one place.

- 1 Host (game creator)
- 3–10 Players
- Real-time gameplay
- Mobile-first UI

---

## 🧱 TECH STACK

### Frontend

- Next.js (App Router)
- TypeScript
- TailwindCSS
- Zustand (state management)
- Socket.io-client

### Backend

- Node.js (NestJS preferred)
- Socket.io (WebSocket)
- PostgreSQL
- Prisma ORM
- Redis (optional for scaling)

### Deployment

- Frontend: Vercel
- Backend: Railway / Render
- DB: Supabase / Neon

---

## 📁 PROJECT STRUCTURE

### Frontend

```
/app
  /page.tsx (home)
  /room/[id]/page.tsx
  /game/[id]/page.tsx

/components
  PlayerCard.tsx
  Timer.tsx
  VotePanel.tsx
  HostControls.tsx

/store
  useGameStore.ts

/lib
  socket.ts
```

---

### Backend

```
/src
  /modules
    /room
    /game
    /player
    /vote

  /gateway (socket logic)
  /services
  /entities
  /prisma
```

---

## 🧩 DATABASE SCHEMA

### User

```ts
id: string;
name: string;
roomId: string;
isAlive: boolean;
```

### Room

```ts
id: string;
hostId: string;
status: "lobby" | "playing" | "finished";
round: number;
```

### PlayerCards

```ts
userId: string
kasb: string
soglik: string
xarakter: string
skill: string
bagaj: string
fakt: string
revealed: string[]
```

### GameState

```ts
roomId: string;
currentSituation: string;
currentDisaster: string;
phase: "discussion" | "reveal" | "vote";
timer: number;
```

### Vote

```ts
userId: string;
targetId: string;
```

---

## 🎮 GAME FLOW LOGIC

### 1. Lobby

- Players join via link
- Host starts game

---

### 2. Game Start

Each player gets:

- 1 Kasb
- 1 Sog‘lik
- 1 Xarakter
- 1 Skill
- 1 Bagaj
- 1 Fakt

---

### 3. Disaster Selection

Randomly pick from DB

---

### 4. Round Loop

#### Phase 1: Situation

- Random situation appears

#### Phase 2: Discussion

- Timer: 120–300 sec

#### Phase 3: Reveal

- Each player reveals 1 card

#### Phase 4: Voting

- Players vote who leaves

#### Phase 5: Elimination

- Most votes → removed

Repeat until 1–2 players remain

---

## ⚡ SOCKET EVENTS

### Client → Server

```
join_room
start_game
reveal_card
vote
next_phase
```

### Server → Client

```
player_joined
game_started
new_round
timer_update
vote_result
player_eliminated
```

---

## 🧠 GAME ENGINE RULES

- Each round → 1 card reveal
- Each player → 1 vote
- Max vote → eliminated
- Tie → random elimination

---

## 🎨 UI/UX REQUIREMENTS

### GENERAL

- Mobile-first
- One-hand usage
- Large buttons
- Minimal text
- Dark theme preferred

---

### SCREENS

#### Home

- Create Room
- Join Room

#### Lobby

- Player list
- Start button (host only)

---

#### Player Screen

- My Cards (hidden/reveal)
- Reveal button
- Timer
- Vote UI

---

#### Host Panel

- Start Game
- Next Round
- Start Voting
- End Game

---

#### Game Screen

- Disaster
- Situation
- Alive players
- Eliminated players

---

## 📱 MOBILE UX RULES

- Buttons ≥ 48px
- Avoid scrolling during gameplay
- Fixed bottom action bar
- Fast transitions
- Haptic feedback (optional)

---

## 🎲 CONTENT STRUCTURE

### disasters

```
id
name
description
```

### situations

```
id
text
difficulty
```

### cards

```
id
type (kasb, skill, etc)
text
```

---

## ⏱ TIMER SYSTEM

- Server authoritative timer
- Broadcast every second

---

## 🔐 AUTH

- No login required
- Nickname only

---

## 🚀 MVP FEATURES

- Lobby system
- Card distribution
- Real-time sync
- Voting system
- Elimination
- Host control

---

## 🧪 FUTURE FEATURES

- Voice chat
- AI moderator
- Custom card packs
- Online matchmaking

---

## 📌 IMPORTANT RULES

- Backend controls game state
- Frontend only renders state
- All actions validated server-side
- No client trust

---

## 🔥 FINAL NOTE

This system must feel:

- FAST
- SIMPLE
- FUN

No unnecessary complexity.

---

## ✅ READY FOR IMPLEMENTATION

This document is optimized for:

- Claude
- Codex
- Cursor
- Copilot

Use it as a direct build spec.

---
