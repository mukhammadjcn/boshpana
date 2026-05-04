function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  // When true, exposes /api/auth/dev-login (no Telegram round-trip).
  // Strictly opt-in via env var — never inferred from NODE_ENV, because
  // the Docker images run with NODE_ENV=production even in local dev.
  // The local docker-compose.yml sets ENABLE_DEV_AUTH=1; production
  // deployments must leave it unset so the route is never mounted.
  enableDevAuth: process.env.ENABLE_DEV_AUTH === "1",
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
    "https://jamoaviy.uz",
  telegramAuthMaxAgeSeconds: Number(
    process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS ?? 86400
  ),
  roomCreationLimit: Number(process.env.ROOM_CREATION_LIMIT_PER_30D ?? 100),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379"
};
