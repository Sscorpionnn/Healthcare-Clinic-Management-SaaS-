"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Resource } from "@clinic/shared/rbac/permissions";
import type { Role } from "@clinic/shared/rbac/roles";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";

type NavItem = {
  href: string;
  label: string;
  resource?: Resource;
  superAdminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/patients", label: "Patients", resource: "patient" },
  { href: "/appointments", label: "Appointments", resource: "appointment" },
  { href: "/documents", label: "Documents", resource: "document" },
  { href: "/billing", label: "Billing", resource: "billing" },
  { href: "/staff", label: "Staff", resource: "staff" },
  { href: "/audit-log", label: "Audit log", resource: "auditLog" },
  { href: "/settings/privacy", label: "Privacy" },
  { href: "/admin/clinics", label: "Clinics", superAdminOnly: true },
  {
    href: "/admin/audit-log",
    label: "Platform audit log",
    superAdminOnly: true,
  },
];

// Visibility here is a UX convenience only — hiding a link a role can't use.
// The API re-checks every request independently (RolesGuard + PolicyGuard);
// this list is never the actual access control. See docs/rbac.md.
export function Sidebar({
  role,
  isSuperAdmin,
}: {
  role: Role | null;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (isSuperAdmin && !item.superAdminOnly) return item.href === "/dashboard";
    if (!role) return false;
    if (!item.resource) return true;
    return can(role, item.resource, "read") || can(role, item.resource, "list");
  });

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4 text-lg font-semibold">
        Clinic Management
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
              pathname === item.href && "bg-accent text-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border p-2">
        <LogoutButton />
      </div>
    </aside>
  );
}
