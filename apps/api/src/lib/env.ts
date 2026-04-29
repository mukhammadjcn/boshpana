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
  adminSecret: requireEnv("ADMIN_JWT_SECRET", "super-secret-admin-jwt")
};
