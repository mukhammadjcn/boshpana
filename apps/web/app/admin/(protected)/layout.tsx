import Link from "next/link";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

export default function AdminProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <header className="sticky top-0 z-30 border-b border-line-subtle bg-bg-base/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand text-xs font-bold text-bg-base">
              B
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                Bunker CMS
              </p>
              <p className="truncate text-xs font-semibold text-ink-primary">
                Admin panel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/"
              className="h-8 rounded-lg border border-line-strong bg-bg-elevated px-3 text-xs font-medium text-ink-secondary leading-8"
            >
              Public
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">{children}</div>
    </main>
  );
}
