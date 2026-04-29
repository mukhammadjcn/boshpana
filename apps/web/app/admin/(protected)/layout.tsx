import Link from "next/link";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

export default function AdminProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#08111f_0%,#020617_100%)] px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-orange-200/70">Bunker CMS</p>
            <h1 className="mt-2 text-2xl font-semibold">Admin boshqaruv paneli</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              Public app
            </Link>
            <AdminLogoutButton />
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
