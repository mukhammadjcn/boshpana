// Mafia game module — skeleton.
//
// Bu skeleton fayl. Schema modellari (`MafiaGame`, `MafiaPlayerRole`,
// `MafiaNightSubmission`, `MafiaDayVote`) tayyor; haqiqiy logika keyingi
// commit'larda bosqichma-bosqich qo'shiladi:
//   1. Lobby + rol tarqatish + role-reveal
//   2. Tun submission'lari + 20s taymer + tun yakuni
//   3. Kun muhokamasi va ovoz berish + tiebreak
//   4. G'alaba sharti + finished e'lon
//
// Hozircha bu sinf `GameRegistry` tomonidan ro'yxatga olinadi va
// `setRealtime` / `shutdown` kabi shared lifecycle hooklarni qo'llaydi
// — ular `BunkerGameService` bilan bir xil interfeysga ega bo'lishi
// kerak, registry'ning `setRealtime` chaqiruvi har ikki o'yin uchun
// ham ishlasin uchun.

type RealtimePublisher = {
  broadcastRoomState: (roomCode: string) => Promise<void>;
  broadcastTimer: (roomCode: string, remainingSeconds: number) => void;
  isSessionOnline?: (roomCode: string, sessionId: string) => boolean;
};

const noopRealtime: RealtimePublisher = {
  broadcastRoomState: async () => undefined,
  broadcastTimer: () => undefined,
  isSessionOnline: () => true
};

export class MafiaGameService {
  private realtime: RealtimePublisher = noopRealtime;

  setRealtime(publisher: RealtimePublisher) {
    this.realtime = publisher;
  }

  // Mafia hozircha o'zining cleanup sweeper'iga ega emas — Room qatlami
  // bo'yicha eskirgan xonalar Bunker sweeper'i tomonidan tozalanadi
  // (status/age bo'yicha, gameType'ga bog'liq emas). Mafia-spetsifik
  // taymerlar paydo bo'lganda shu yerda boshlanadi.
  async shutdown() {
    // Hech qanday timer/interval hali yo'q.
  }
}
