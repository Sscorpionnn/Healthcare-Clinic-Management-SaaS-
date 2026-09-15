# Multi-Tenancy Model

## Tenant unit

`Clinic` is the tenant boundary. Every tenant-scoped table carries a
non-nullable `clinicId` foreign key. `SUPER_ADMIN` is the only role that can
act across tenants (platform operations: creating clinics, suspending a
clinic, viewing platform-level audit/billing health) and even then every
cross-tenant action is itself audit-logged with an explicit reason code.

## Isolation strategy: defense in depth

Single shared database, **not** schema-per-tenant or database-per-tenant.
Rationale: at expected scale, per-tenant provisioning overhead and migration
fan-out cost outweigh the isolation benefit, provided isolation is enforced
at two independent layers so an application bug in one layer doesn't leak
data.

### Layer 1 — Application-level scoping (primary)

- Every Prisma query for a tenant-scoped model goes through a repository/
  service method that requires a `TenantContext` (resolved from the
  authenticated request, never from client input) and injects
  `where: { clinicId }` automatically. Raw/ad-hoc Prisma calls that skip this
  helper are disallowed by lint rule + code review checklist.
- `TenantGuard` (NestJS) runs after `AuthGuard`, reads `clinicId` from the
  verified JWT claims, and attaches an immutable `TenantContext` to the
  request. Route handlers never read `clinicId` from params/body/query for
  authorization purposes — only for cross-checking that a path param matches
  the authenticated tenant (mismatch => 404, not 403, to avoid confirming
  resource existence across tenants).

### Layer 2 — PostgreSQL Row-Level Security (defense in depth)

- Every tenant-scoped table has `ENABLE ROW LEVEL SECURITY` and a policy:
  `USING (clinic_id = current_setting('app.current_clinic_id')::uuid)`.
- At the start of each request's DB unit of work, the API sets
  `SET LOCAL app.current_clinic_id = '<uuid>'` inside the same transaction,
  scoped to that transaction only (never a global session setting on a
  pooled connection).
- `SUPER_ADMIN` platform operations use a separate Prisma client bound to a
  Postgres role that bypasses RLS (`BYPASSRLS`), used only in the `clinics`
  admin module, never in tenant-data modules.
- This means even a missing `where: { clinicId }` in application code
  cannot leak cross-tenant rows — the database itself refuses them.

## IDOR prevention

- All entity lookups by ID are scoped by tenant at the query level (Layer 1)
  and re-enforced by RLS (Layer 2).
- Sequential integer IDs are never exposed; primary keys are random UUIDv4,
  making enumeration/guessing infeasible.
- Resource-not-found and resource-in-another-tenant both return `404`, so
  responses don't leak cross-tenant existence.
- Automated IDOR test suite (see [test-strategy.md](./test-strategy.md))
  creates two clinics and asserts every entity-by-id endpoint rejects the
  other tenant's token.

## Connection pooling caveat

Because `SET LOCAL` is transaction-scoped, tenant context never leaks across
requests sharing a pooled connection (PgBouncer-safe in transaction mode).
The API never uses `SET` (session-level) for tenant context.

## Tenant lifecycle

- Provisioning: `SUPER_ADMIN` creates a `Clinic` record + a `CLINIC_ADMIN`
  invitation. No shared default data seeded into a new tenant.
- Suspension: a suspended clinic's non-super-admin tokens are rejected at
  `AuthGuard` (checked against a fresh DB read, not just JWT claims, so
  suspension takes effect immediately rather than waiting for token expiry).
- Deletion: soft-delete with a retention window (see
  [privacy-model.md](./privacy-model.md)), then a scheduled hard-delete job.
