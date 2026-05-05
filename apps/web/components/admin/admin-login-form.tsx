"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@bunker.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message ?? "Login amalga oshmadi");
      }

      router.replace("/admin/dashboard");
      router.refresh();
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl border border-line-subtle bg-bg-surface p-5 shadow-card"
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
        Admin
      </p>
      <h1 className="mt-1 text-xl font-semibold text-ink-primary">
        Tizimga kirish
      </h1>

      <div className="mt-4 grid gap-2.5">
        <label className="grid gap-1 text-xs">
          <span className="text-ink-muted">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 rounded-lg border border-line-strong bg-bg-base px-3 text-sm text-ink-primary outline-none focus:border-brand"
            placeholder="admin@example.com"
            autoComplete="email"
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-ink-muted">Parol</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 rounded-lg border border-line-strong bg-bg-base px-3 text-sm text-ink-primary outline-none focus:border-brand"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
      </div>

      <button
        disabled={loading}
        className="mt-4 flex h-10 w-full items-center justify-center rounded-lg bg-brand text-sm font-semibold text-bg-base transition active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? "Tekshirilmoqda..." : "Tizimga kirish"}
      </button>

      {error ? (
        <p className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-1.5 text-xs text-bad">
          {error}
        </p>
      ) : null}
    </form>
  );
}
