import { getCurrentUser } from "@/lib/api-server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardOverviewPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-muted-foreground">{user?.email}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Role</CardTitle>
            <CardDescription>Your access level in this clinic</CardDescription>
          </CardHeader>
          <CardContent className="text-lg font-medium">
            {user?.isSuperAdmin
              ? "Platform administrator"
              : (user?.membership?.role ?? "—")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Clinic</CardTitle>
            <CardDescription>Currently active tenant</CardDescription>
          </CardHeader>
          <CardContent className="text-lg font-medium">
            {user?.isSuperAdmin
              ? "Platform-wide"
              : (user?.membership?.clinicName ?? "—")}
          </CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">
        Use the navigation to manage patients, appointments, documents, and
        billing for your clinic. Every action here is scoped strictly to your
        clinic and role — see the platform&apos;s privacy and RBAC documentation
        for details.
      </p>
    </div>
  );
}
