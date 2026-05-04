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

const WELCOME_TEXT = `👋 *Jamoaviy.uz*

Telegram ichida do'stlaringiz bilan tezda room ochib, birga o'ynaydigan jamoaviy mini app.

🎮 Hozircha ikki o'yin bor: *Mafia* va *Bunker*
🚪 Room oching yoki kod orqali tayyor xonaga qo'shiling
👥 Yangilik va chat uchun Telegram guruhimizga ham kirishingiz mumkin

⏱ Bir o'yin: 10–60 daqiqa
👥 3–16 o'yinchi
📱 To'liq mobile-friendly`;

function buildWebAppUrl(): string {
  // Telegram opens this URL inside the in-app browser. We always direct
  // to /telegram so the auth/loading flow runs.
  const base = env.telegramWebAppUrl.replace(/\/$/, "");
  return `${base}/telegram`;
}

function buildSiteUrl(path: string): string {
  const base = env.telegramWebAppUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .webApp("🎮 O'yin yaratish", buildWebAppUrl())
    .row()
    .url("🕵️ Mafia o'yini", buildSiteUrl("/games/mafia"))
    .row()
    .url("☢️ Bunker o'yini", buildSiteUrl("/games/bunker"))
    .row()
    .url("👥 Telegram guruhi", TELEGRAM_GROUP_URL);
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
      await ctx.reply(WELCOME_TEXT, {
        parse_mode: "Markdown",
        reply_markup: buildKeyboard()
      });
    } catch (error) {
      console.error("[bot] /start handler failed", error);
    }
  });

  bot.command("help", async (ctx) => {
    try {
      await ctx.reply(
        "Quyidagi tugmalardan birini tanlang: o'yin yarating, Mafia/Bunker sahifasini oching yoki Telegram guruhga o'ting.",
        { reply_markup: buildKeyboard() }
      );
    } catch (error) {
      console.error("[bot] /help handler failed", error);
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
