import { DashboardShell } from "@/components/dashboard-shell";

export const metadata = {
  robots: { index: false, follow: false }
};

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
