"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message ?? "Login amalga oshmadi.");
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
      className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 text-white shadow-2xl"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-orange-200/70">Admin access</p>
      <h1 className="mt-3 text-3xl font-semibold">Kirish</h1>
      <div className="mt-6 grid gap-4">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 rounded-2xl border border-white/10 bg-slate-900/80 px-4 outline-none"
          placeholder="admin@bunker.local"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 rounded-2xl border border-white/10 bg-slate-900/80 px-4 outline-none"
          placeholder="Parol"
        />
        <button
          disabled={loading}
          className="h-12 rounded-full bg-orange-500 font-semibold text-slate-950 disabled:opacity-60"
        >
          Kirish
        </button>
      </div>
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </form>
  );
}
