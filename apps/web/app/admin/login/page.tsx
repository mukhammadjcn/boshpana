import { AdminLoginForm } from "@/components/admin/admin-login-form";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_25%),linear-gradient(180deg,#08111f_0%,#020617_100%)] px-4">
      <AdminLoginForm />
    </main>
  );
}
