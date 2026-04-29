"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="h-8 rounded-lg border border-line-strong bg-bg-elevated px-3 text-xs font-medium text-ink-secondary"
    >
      Chiqish
    </button>
  );
}
