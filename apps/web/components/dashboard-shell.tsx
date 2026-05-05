"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { getAuthToken } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

// Wraps every page under /dashboard/*: blocks unauthenticated visitors at
// the door (kicks them to /), then renders the page with the persistent
// bottom navigation. Pages don't need to mount BottomNav themselves.
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getAuthToken()) {
      setReady(true);
      return;
    }
    router.replace("/");
  }, [router]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg-base text-ink-secondary">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          {t("yuklanmoqda")}
        </div>
      </main>
    );
  }

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
