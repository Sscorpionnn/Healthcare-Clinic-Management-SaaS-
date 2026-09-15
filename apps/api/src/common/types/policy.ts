import type { Prisma } from "@clinic/database";
import type { AuthenticatedUser, TenantContext } from "./auth.types";

/** A tenant-scoped Prisma client (already RLS-context-bound for the current request). */
export type TenantPrismaClient = Prisma.TransactionClient;

export interface PolicyCheckContext {
  user: AuthenticatedUser;
  tenant: TenantContext;
  /** Route params, e.g. `{ id: '...' }` — never trusted for tenant scoping, only for resource lookup. */
  params: Record<string, string>;
  tx: TenantPrismaClient;
}

/**
 * Row-level ownership check — the second, fine-grained layer of RBAC
 * enforcement described in docs/rbac.md (RolesGuard is the coarse layer).
 * Implementations must return `false` (never throw) for "not authorized",
 * so PolicyGuard can map it to a uniform 404 — see docs/multi-tenancy.md,
 * IDOR prevention (not-found and cross-tenant/cross-owner both look the
 * same to the caller).
 */
export interface ResourcePolicy {
  check(context: PolicyCheckContext): Promise<boolean>;
}
