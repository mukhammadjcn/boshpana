import {
  MafiaCitizenQuestion,
  MafiaNightActionType,
  MafiaPhase,
  MafiaRole,
  MafiaTeam,
  RoomStatus
} from "@prisma/client";

// Tunda taymerga oid sozlama. Klassik "yashirin tap" stoli uchun
// 20 soniya — barcha o'yinchi nimadir bosib turishga ulguradi, lekin
// vaqt fosh qilmaydi (kim qarorini avval qabul qildi degan xulosa
// chiqarib bo'lmaydi).
export const MAFIA_NIGHT_DURATION_SECONDS = 20;
export const MAFIA_DAY_DISCUSSION_DURATION_SECONDS = 180;
export const MAFIA_DAY_VOTE_DURATION_SECONDS = 60;

// Komisar va doktor uchun barqaror cheklovlar — schema'da ham `Int`
// counterlar bor, bu yerda tekshirish chegaralarini bitta joyda saqlab
// turadi.
export const MAFIA_SHERIFF_MAX_SHOTS = 2;
export const MAFIA_DOCTOR_MAX_SELF_HEALS = 1;

// Public state har bir o'yinchining role'idan kelib chiqib turlicha
// quyidagi maydonlarni to'ldiradi. Frontend faqat shu shape'ga
// tayanadi — DB modellarini ko'rmaydi.
export type MafiaPublicState = {
  room: {
    id: string;
    code: string;
    status: RoomStatus;
    maxPlayers: number;
  };
  game: {
    phase: MafiaPhase;
    nightNumber: number;
    dayNumber: number;
    timerEndsAt: string | null;
    remainingSeconds: number;
    config: {
      mafiaCount: number;
      hasSheriff: boolean;
      hasDoctor: boolean;
    };
    sheriffShotsRemaining: number;
    doctorSelfHealsRemaining: number;
    // ASSIGN_ROLES bosqichida foydalanuvchi va host'ga ko'rsatish
    // uchun: nechta tirik o'yinchi rolini tasdiqlagan / jami necha
    // tirik. NIGHT bosqichida ham 0/0 bo'ladi.
    roleConfirmations: { confirmed: number; total: number };
    winner: MafiaTeam | null;
    // Joriy tunda kim o'lganini ertalab e'lon qilish uchun. Bo'sh array
    // = "doktor saqlab qoldi" yoki "tinch tun".
    lastNightVictims: Array<{ playerId: string; role: MafiaRole }>;
    // Doktor mafia/komisar nishonini saqlab qolgan bo'lsa true bo'ladi
    // — frontend "Doktor 1 fuqaroni saqlab qoldi" matnini chiqaradi.
    lastNightDoctorSaved: boolean;
    // Kun ovozida chetlatilgan o'yinchi.
    lastEliminatedPlayerId: string | null;
    lastEliminatedRole: MafiaRole | null;
    // Tiebreak holatida qaysi nomzodlar qayta ovozga chiqishi.
    tiebreakCandidateIds: string[];
  };
  // O'yinchining o'zining ko'zi orqali ko'rinadigan ma'lumotlar.
  me: {
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    sessionId: string;
    role: MafiaRole | null;
    // Mafia uchun — sheriklarining playerId'lari. Boshqalar uchun [].
    mafiaTeammates: string[];
    // Sherif uchun — bu tungacha tekshirilganlar tarixi.
    sheriffChecks: Array<{ playerId: string; isMafia: boolean; nightNumber: number }>;
    // Aholi uchun — bu tunda berilgan tasodifiy savol.
    citizenQuestion: MafiaCitizenQuestion | null;
    // O'yinchining shu raunddagi tanlovi (mavjud bo'lsa). Mafia uchun
    // bu sherigi ham ko'radi (maydonni service tomonida to'ldiradi).
    pendingNightTargetId: string | null;
    // Sherif uchun: tekshirish yoki o'q uzish modidan qaysi biri tanlangan.
    // Boshqa rollar uchun ham mavjud (CITIZEN_GUESS_*, MAFIA_KILL,
    // DOCTOR_HEAL) — UI shu maydondan kelib chiqib pendingNightTargetId
    // ni qaysi action sifatida render qilishni biladi.
    pendingNightAction: MafiaNightActionType | null;
    // True once the user tapped "Tasdiqlash" on their role-reveal modal.
    // Frontend uses this to flip the screen into the "host'ni kuting"
    // waiting state.
    roleConfirmed: boolean;
  } | null;
  // Hamma uchun ko'rinadigan o'yinchilar ro'yxati.
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    online: boolean;
    seatOrder: number;
    // Roli ochilgan bo'lsa (o'lim/lynch yoki mafia teammate ko'rinishi)
    // — null bo'lmaydi.
    revealedRole: MafiaRole | null;
  }>;
  // Mafia jamoasiga ko'rinadigan qo'shimcha — sheriklarning real-time
  // tanlovlari. Boshqa rollar uchun bo'sh array.
  mafiaPicks: Array<{ actorPlayerId: string; targetPlayerId: string | null }>;
  votes: {
    total: number;
    submittedByMe: boolean;
  };
};
