import { redirect } from "next/navigation";
import type { Role } from "@clinic/shared/rbac/roles";
import { getCurrentUser } from "@/lib/api-server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SessionProvider } from "@/components/dashboard/session-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <SessionProvider user={user}>
      <div className="flex min-h-screen">
        <Sidebar
          role={(user.membership?.role as Role | undefined) ?? null}
          isSuperAdmin={user.isSuperAdmin}
        />
        <main className="flex-1 overflow-y-auto bg-secondary/40 p-6">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
