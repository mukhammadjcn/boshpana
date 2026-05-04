import { Bot, type CommandContext, type Context, InlineKeyboard, Keyboard } from "grammy";

type BotCtx = CommandContext<Context>;

import { env } from "../lib/env";
import { upsertUserFromTelegram } from "../services/auth-service";
import {
  bindChatToSession,
  getAuthSession,
  getAuthSessionByBotHash,
  getAuthSessionByChatId,
  updateAuthSession
} from "../services/auth-session-store";

let botInstance: Bot | null = null;

const TELEGRAM_GROUP_URL = "https://t.me/jamoaviy_group";
const PLAYLOAD_STARTGROUP = "play";
const GROUP_ADMIN_ONLY_TEXT =
  "⛔️ O'yinlarni faqat guruh adminlari boshlashi mumkin.";

const COMMUNITY_BUTTON_TEXT = "👥 Hamjamiyat guruhi";

const WELCOME_TEXT = `🎮 *Jamoaviy.uz* ga xush kelibsiz!

Bu yerda do'stlaringiz bilan *Mafia* va *Bunker* o'yinlari uchun room ochishingiz va tayyor xonaga qo'shilishingiz mumkin.

👇 Tugmalardan birini tanlang:
• *Botni guruhga qo'shish* — botni yangi chatga olib boring
• *Mafia o'yini* — to'g'ridan-to'g'ri Mafia create sahifasi
• *Bunker o'yini* — to'g'ridan-to'g'ri Bunker create sahifasi
• *Hamjamiyat guruhi* — chat va yangiliklar

⏱ Bir o'yin: 10–60 daqiqa
👥 3–16 o'yinchi
📱 To'liq mobile-friendly`;

const GROUP_WELCOME_TEXT = `👋 *Rahmat, meni guruhga qo'shdingiz!*

Bugun nima o'ynaymiz? Men *Jamoaviy.uz* botiman — shu guruhdagilar uchun *Mafia* va *Bunker* o'yinlarini tez boshlashga yordam beraman.

👇 Adminlar */games* yoki */play* deb yozib, o'yin tugmalarini ochishi mumkin.

Pastdagi tugmalar orqali yangi guruhga bot qo'shing, Mafia/Bunker create sahifalarini oching yoki hamjamiyat guruhiga o'ting.`;

function buildWebAppUrl(): string {
  // Telegram opens this URL inside the in-app browser. We always direct
  // to /telegram so the auth/loading flow runs.
  const base = env.telegramWebAppUrl.replace(/\/$/, "");
  return `${base}/telegram`;
}

function buildTelegramEntryUrl(targetPath?: string): string {
  const url = new URL(buildWebAppUrl());
  if (targetPath) {
    url.searchParams.set("redirect", targetPath);
  }
  return url.toString();
}

function buildStartAppLink(startParam: string): string | null {
  const username = env.telegramBotUsername.trim().replace(/^@/, "");
  const appName = env.telegramWebAppName.trim();
  if (!username || !appName) return null;
  const param = encodeURIComponent(startParam);
  return `https://t.me/${username}/${appName}?startapp=${param}`;
}

function buildAddToGroupUrl(): string | null {
  const username = env.telegramBotUsername.trim().replace(/^@/, "");
  if (!username) return null;
  return `https://t.me/${username}?startgroup=${PLAYLOAD_STARTGROUP}`;
}

function buildUniversalKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const addToGroupUrl = buildAddToGroupUrl();
  const mafiaLink = buildStartAppLink("create_mafia");
  const bunkerLink = buildStartAppLink("create_bunker");

  if (addToGroupUrl) {
    keyboard.url("➕ Botni guruhga qo'shish", addToGroupUrl).row();
  } else {
    keyboard.webApp("➕ Botni guruhga qo'shish", buildWebAppUrl()).row();
  }

  return keyboard
    .url("🕵️ Mafia o'yini", mafiaLink ?? buildWebAppUrl())
    .url("☢️ Bunker o'yini", bunkerLink ?? buildWebAppUrl())
    .row()
    .url("👥 Hamjamiyat guruhi", TELEGRAM_GROUP_URL);
}

function buildEntryInlineKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const addToGroupUrl = buildAddToGroupUrl();

  if (addToGroupUrl) {
    keyboard.url("➕ Botni guruhga qo'shish", addToGroupUrl).row();
  }

  return keyboard.url("👥 Hamjamiyat guruhi", TELEGRAM_GROUP_URL);
}

function buildGroupGamesKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const addToGroupUrl = buildAddToGroupUrl();
  const mafiaLink = buildStartAppLink("create_mafia");
  const bunkerLink = buildStartAppLink("create_bunker");

  keyboard
    .url("Mafia", mafiaLink ?? buildWebAppUrl())
    .url("Bunker", bunkerLink ?? buildWebAppUrl())
    .row();

  if (addToGroupUrl) {
    keyboard.url("➕ Botni guruhga qo'shish", addToGroupUrl).row();
  }

  return keyboard.url("👥 Hamjamiyat guruhi", TELEGRAM_GROUP_URL);
}

function buildPersistentPrivateKeyboard(): Keyboard {
  return new Keyboard()
    .webApp("🎮 O'yinni boshlash", buildTelegramEntryUrl("/dashboard"))
    .row()
    .webApp("🕵️ Mafia o'yini", buildTelegramEntryUrl("/dashboard/create/mafia"))
    .webApp(
      "☢️ Bunker o'yini",
      buildTelegramEntryUrl("/dashboard/create/bunker")
    )
    .row()
    .text(COMMUNITY_BUTTON_TEXT)
    .persistent()
    .resized()
    .placeholder("Jamoaviy tugmalaridan birini tanlang");
}

function isGroupChat(type: string) {
  return type === "group" || type === "supergroup";
}

function isActiveStatus(status: string) {
  return status === "member" || status === "administrator";
}

function isAdminStatus(status: string) {
  return status === "administrator" || status === "creator";
}

async function ensureGroupAdmin(ctx: Context): Promise<boolean> {
  if (!ctx.chat || !isGroupChat(ctx.chat.type) || !ctx.from) return true;

  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    if (isAdminStatus(member.status)) {
      return true;
    }
  } catch (error) {
    console.error("[bot] getChatMember failed", error);
    await ctx.reply("Admin huquqini tekshirib bo'lmadi. Qaytadan urinib ko'ring.");
    return false;
  }

  await ctx.reply(GROUP_ADMIN_ONLY_TEXT);
  return false;
}

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.length < 7) return null;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export async function startTelegramBot(): Promise<Bot | null> {
  if (!env.telegramBotToken) {
    console.log("[bot] TELEGRAM_BOT_TOKEN yo'q — bot worker ishga tushmaydi.");
    return null;
  }
  if (botInstance) return botInstance;

  const bot = new Bot(env.telegramBotToken);

  bot.command("start", async (ctx) => {
    const arg = (ctx.match ?? "").trim();
    const authMatch = arg.match(/^auth[_-](.+)$/i);
    if (authMatch && ctx.from) {
      await handleBotAuthDeepLink(ctx, authMatch[1]);
      return;
    }
    try {
      const inGroup = isGroupChat(ctx.chat.type);
      await ctx.reply(WELCOME_TEXT, {
        parse_mode: "Markdown",
        reply_markup: buildEntryInlineKeyboard()
      });
      if (!inGroup) {
        await ctx.reply("⬇️ Doimiy o'yin tugmalari pastda tayyor.", {
          reply_markup: buildPersistentPrivateKeyboard()
        });
      }
    } catch (error) {
      console.error("[bot] /start handler failed", error);
    }
  });

  bot.command("help", async (ctx) => {
    try {
      const inGroup = isGroupChat(ctx.chat.type);
      await ctx.reply(
        "Quyidagi tugmalardan birini tanlang: botni guruhga qo'shing, Mafia/Bunker create sahifasini oching yoki hamjamiyat guruhiga o'ting.",
        {
          reply_markup: buildEntryInlineKeyboard()
        }
      );
      if (!inGroup) {
        await ctx.reply("⬇️ Doimiy o'yin tugmalari pastda tayyor.", {
          reply_markup: buildPersistentPrivateKeyboard()
        });
      }
    } catch (error) {
      console.error("[bot] /help handler failed", error);
    }
  });

  bot.hears(COMMUNITY_BUTTON_TEXT, async (ctx) => {
    if (isGroupChat(ctx.chat.type)) return;
    try {
      await ctx.reply(
        "Bu *Jamoaviy.uz* platformasining ommaviy chatidir. U yerda savollar berishingiz, o'yinlarga oid muhokamalarda qatnashishingiz va yangiliklarni kuzatishingiz mumkin.",
        {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard().url(
            "👥 Guruhga kirish",
            TELEGRAM_GROUP_URL
          )
        }
      );
    } catch (error) {
      console.error("[bot] community handler failed", error);
    }
  });

  bot.command(["games", "play"], async (ctx) => {
    if (!(await ensureGroupAdmin(ctx))) return;

    try {
      await ctx.reply("Bugun nima o'ynaymiz? Pastdagi tugmalardan birini tanlang.", {
        parse_mode: "Markdown",
        reply_markup: buildGroupGamesKeyboard()
      });
    } catch (error) {
      console.error("[bot] /games handler failed", error);
    }
  });

  bot.on("my_chat_member", async (ctx) => {
    const chat = ctx.chat;
    if (!isGroupChat(chat.type)) return;

    const oldStatus = ctx.myChatMember.old_chat_member.status;
    const newStatus = ctx.myChatMember.new_chat_member.status;
    if (isActiveStatus(oldStatus) || !isActiveStatus(newStatus)) return;

    try {
      await ctx.reply(GROUP_WELCOME_TEXT, {
        parse_mode: "Markdown",
        reply_markup: buildEntryInlineKeyboard()
      });
    } catch (error) {
      console.error("[bot] group welcome failed", error);
    }
  });

  bot.on("message:contact", async (ctx) => {
    if (!ctx.from || !ctx.message?.contact) return;
    const contact = ctx.message.contact;
    if (
      contact.user_id !== undefined &&
      String(contact.user_id) !== String(ctx.from.id)
    ) {
      await ctx.reply(
        "Iltimos, faqat o'zingizning telefon raqamingizni ulashing.",
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }
    const phone = normalizePhone(contact.phone_number);
    if (!phone) {
      await ctx.reply("Telefon raqam noto'g'ri formatda.", {
        reply_markup: { remove_keyboard: true }
      });
      return;
    }
    const chatId = String(ctx.from.id);
    const session = await getAuthSessionByChatId(chatId);
    if (!session) {
      await ctx.reply(
        "Avtorizatsiya sessiyasi topilmadi yoki muddati tugagan. Saytda qaytadan urinib ko'ring.",
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }
    try {
      const user = await upsertUserFromTelegram(
        {
          id: ctx.from.id,
          username: ctx.from.username,
          first_name: ctx.from.first_name,
          last_name: ctx.from.last_name,
          language_code: ctx.from.language_code,
          is_premium: ctx.from.is_premium
        },
        phone
      );
      await updateAuthSession(session.token, {
        status: "confirmed",
        userId: user.id
      });
      await ctx.reply(
        "✅ Telefon raqam qabul qilindi. Saytga qayting — avtomatik kirib turasiz.",
        { reply_markup: { remove_keyboard: true } }
      );
    } catch (error) {
      console.error("[bot] phone share failed", error);
      await ctx.reply("Xatolik yuz berdi. Qaytadan urinib ko'ring.", {
        reply_markup: { remove_keyboard: true }
      });
    }
  });

  bot.callbackQuery(/^auth_(yes|no):(.+)$/, async (ctx) => {
    const action = ctx.match![1];
    const token = ctx.match![2];
    const session = await getAuthSession(token);
    try {
      await ctx.answerCallbackQuery();
    } catch {
      // ignore
    }
    if (!session) {
      try {
        await ctx.editMessageText("Sessiya topilmadi yoki muddati tugagan.");
      } catch {
        // ignore
      }
      return;
    }
    if (action === "no") {
      await updateAuthSession(token, { status: "rejected" });
      try {
        await ctx.editMessageText("Bekor qilindi.");
      } catch {
        // ignore
      }
      return;
    }
    if (!ctx.from) return;
    if (!session.userId) {
      try {
        await ctx.editMessageText(
          "Foydalanuvchi topilmadi. Iltimos, qaytadan urinib ko'ring."
        );
      } catch {
        // ignore
      }
      return;
    }
    await updateAuthSession(token, { status: "confirmed" });
    try {
      await ctx.editMessageText(
        "✅ Tasdiqlandi. Saytga qayting — avtomatik kirib turasiz."
      );
    } catch {
      // ignore
    }
  });

  bot.catch((err) => {
    console.error("[bot] runtime error", err);
  });

  // Long-polling — no public webhook required. We start it but don't
  // await; bot.start() returns a promise that only resolves when the bot
  // is stopped.
  bot.start({
    drop_pending_updates: true,
    onStart: (info) => {
      console.log(`[bot] @${info.username} polling boshlandi.`);
    }
  }).catch((error) => {
    console.error("[bot] polling failed", error);
  });

  botInstance = bot;
  return bot;
}

export async function stopTelegramBot(): Promise<void> {
  if (!botInstance) return;
  try {
    await botInstance.stop();
  } catch (error) {
    console.error("[bot] stop failed", error);
  }
  botInstance = null;
}

// Handles `/start auth_<hash>` from the browser-initiated bot login flow.
async function handleBotAuthDeepLink(
  ctx: BotCtx,
  hash: string
): Promise<void> {
  if (!ctx.from) return;
  const chatId = String(ctx.from.id);
  const session = await getAuthSessionByBotHash(hash);
  if (!session) {
    await ctx.reply(
      "Avtorizatsiya sessiyasi topilmadi yoki muddati tugagan. Saytda qaytadan urinib ko'ring."
    );
    return;
  }
  await bindChatToSession(session.token, chatId);

  // If the Telegram user is already linked + has phone, ask for explicit
  // confirmation (Yes/No) so a hostile party with the link can't silently
  // log in as someone else who happens to be in this chat.
  const tgUser = {
    id: ctx.from.id,
    username: ctx.from.username,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
    language_code: ctx.from.language_code,
    is_premium: ctx.from.is_premium
  };
  let user;
  try {
    user = await upsertUserFromTelegram(tgUser);
  } catch (error) {
    console.error("[bot] auth upsert failed", error);
    await ctx.reply("Server xatosi. Qaytadan urinib ko'ring.");
    return;
  }

  if (user.phone) {
    await updateAuthSession(session.token, { userId: user.id });
    await ctx.reply(
      `🔐 Saytga kirishni tasdiqlaysizmi, ${user.firstName ?? user.nickname ?? "do'stim"}?`,
      {
        reply_markup: new InlineKeyboard()
          .text("✅ Ha, kiraman", `auth_yes:${session.token}`)
          .text("❌ Yo'q", `auth_no:${session.token}`)
      }
    );
    return;
  }

  // First-time user — request phone via contact button.
  await ctx.reply(
    "Saytga kirish uchun telefon raqamingizni ulashing. Bu bir martalik amal — keyingi safar avtomatik kirib turasiz.",
    {
      reply_markup: new Keyboard()
        .requestContact("📱 Telefon raqamni ulashish")
        .oneTime()
        .resized()
    }
  );
}
