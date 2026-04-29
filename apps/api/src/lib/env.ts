function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.API_PORT ?? 4000),
  adminEmail: requireEnv("ADMIN_EMAIL", "admin@bunker.local"),
  adminPassword: requireEnv("ADMIN_PASSWORD", "ChangeMe123!"),
  adminSecret: requireEnv("ADMIN_JWT_SECRET", "super-secret-admin-jwt"),
  jwtSecret: requireEnv("JWT_SECRET", "dev-jwt-secret-change-me"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "30d",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "",
  telegramWebAppName: process.env.TELEGRAM_WEB_APP_NAME ?? "",
  telegramWebAppUrl:
    process.env.TELEGRAM_WEB_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://bunker.alijonov.tech",
  telegramAuthMaxAgeSeconds: Number(
    process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS ?? 86400
  ),
  roomCreationLimit: Number(process.env.ROOM_CREATION_LIMIT_PER_30D ?? 10)
};
