import { Suspense } from "react";

import { AdminDashboard } from "@/components/admin/admin-dashboard";

// useSearchParams() inside AdminDashboard needs a Suspense boundary so the
// prerender doesn't bail out at build time.
export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-10 text-sm text-ink-secondary">
          Yuklanmoqda...
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}
