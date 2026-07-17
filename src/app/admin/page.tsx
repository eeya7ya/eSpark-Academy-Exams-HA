import { redirect } from "next/navigation";
import { validateAdminSession } from "@/lib/auth";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await validateAdminSession();
  if (!authenticated) {
    redirect("/admin/login");
  }
  return <AdminDashboard />;
}
