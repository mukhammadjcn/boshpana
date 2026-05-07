import { buildPublicMetadata } from "@/lib/site";
import { Suspense } from "react";

import { LoadingState } from "@/components/loading-state";
import { LoginPage } from "@/components/login-page";

export const metadata = {
  ...buildPublicMetadata({
    title: "Tizimga kirish — Jamoaviy.uz",
    description: "Telegram orqali Jamoaviy.uz hisobingizga kiring.",
    path: "/login"
  }),
  robots: { index: false, follow: false }
};

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <main>
          <LoadingState label="Yuklanmoqda..." />
        </main>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
