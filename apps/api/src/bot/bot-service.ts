import { Bot, InlineKeyboard } from "grammy";

import { env } from "../lib/env";

let botInstance: Bot | null = null;

const WELCOME_TEXT = `👋 *Boshpana — Bunker Online*

Halokatdan keyin bunkerda kim qoladi? 6 ta yashirin atribut, ovoz berish va eliminatsiya bilan o'ynaladigan real-time party o'yin.

🎮 Mini App'da o'ynang — do'stlaringiz bilan room oching yoki ulashilgan kod orqali kirib boring.

⏱ Bir o'yin: 10–20 daqiqa
👥 3–10 o'yinchi
📱 To'liq mobile-friendly`;

function buildWebAppUrl(): string {
  // Telegram opens this URL inside the in-app browser. We always direct
  // to /telegram so the auth/loading flow runs.
  const base = env.telegramWebAppUrl.replace(/\/$/, "");
  return `${base}/telegram`;
}

function buildKeyboard(): InlineKeyboard {
  const url = buildWebAppUrl();
  return new InlineKeyboard().webApp("🎮 O'yinni ochish", url);
}

export async function startTelegramBot(): Promise<Bot | null> {
  if (!env.telegramBotToken) {
    console.log("[bot] TELEGRAM_BOT_TOKEN yo'q — bot worker ishga tushmaydi.");
    return null;
  }
  if (botInstance) return botInstance;

  const bot = new Bot(env.telegramBotToken);

  bot.command("start", async (ctx) => {
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
        "Yordam kerak bo'lsa, /start buyrug'ini bosib o'yinni Mini App'da oching.",
        { reply_markup: buildKeyboard() }
      );
    } catch (error) {
      console.error("[bot] /help handler failed", error);
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
