"use client";

import * as React from "react";
import type { Role } from "@clinic/shared/rbac/roles";
import type { CurrentUser } from "@/lib/types";

const SessionContext = React.createContext<CurrentUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}

/** Current authenticated user, as resolved server-side for this layout. */
export function useSession(): CurrentUser {
  const user = React.useContext(SessionContext);
  if (!user) {
    throw new Error(
      "useSession() must be used within the authenticated dashboard layout",
    );
  }
  return user;
}

/** The current user's role within their active clinic, or null for a
 * platform SUPER_ADMIN (who has no clinic-scoped role). */
export function useRole(): Role | null {
  const user = useSession();
  return (user.membership?.role as Role | undefined) ?? null;
}
