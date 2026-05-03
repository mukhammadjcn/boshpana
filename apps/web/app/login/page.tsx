import { Suspense } from "react";

import { LoginPage } from "@/components/login-page";

export const metadata = {
  title: "Tizimga kirish — Jamoaviy.uz"
};

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-bg-base text-ink-secondary">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
            Yuklanmoqda...
          </div>
        </main>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
