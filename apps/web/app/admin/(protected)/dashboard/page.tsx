import { Suspense } from "react";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { LoadingState } from "@/components/loading-state";

// useSearchParams() inside AdminDashboard needs a Suspense boundary so the
// prerender doesn't bail out at build time.
export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <LoadingState
          label="Yuklanmoqda..."
          fullScreen={false}
          className="py-10"
        />
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}
