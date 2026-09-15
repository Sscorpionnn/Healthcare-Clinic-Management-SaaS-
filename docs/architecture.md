# Architecture Overview

## System shape

Monorepo (pnpm workspaces) with two deployable apps and shared packages:

```
apps/
  api/        NestJS backend (REST + WebSocket gateway)
  web/        Next.js 16 frontend (App Router)
packages/
  database/   Prisma schema, migrations, seed
  shared/     Zod schemas, DTO types, RBAC permission matrix, shared constants
  config/     Shared ESLint/TS configs
```

Rationale: a single backend service (not microservices) is the right call at this
stage — one Postgres database with strict row-level tenant isolation gives
strong consistency guarantees for clinical data, and a modular monolith keeps
the audit/RBAC/tenant-isolation fabric enforced in exactly one place instead of
re-implemented per service. NestJS modules map 1:1 to the domain modules in the
spec, so splitting into services later (if a specific module needs independent
scaling — e.g. Documents/Notifications) is a lift-and-shift, not a rewrite.

## Request flow

```
Client (Next.js) --HTTPS--> API Gateway (NestJS)
                                 |
                     Helmet, CORS, CSRF, rate limit (Redis)
                                 |
                     AuthGuard (JWT) -> TenantGuard -> RolesGuard -> PolicyGuard
                                 |
                     Controller -> Service -> Prisma (RLS-scoped connection)
                                 |
                     AuditInterceptor (async, redacted) -> BullMQ -> audit_log
                                 |
                     Response (DTO-shaped, never raw entities)
```

Every authenticated request carries a tenant context (`clinicId`) resolved
from the JWT, never from a client-supplied header/body field, and that value
is set as a Postgres session variable so Row-Level Security enforces isolation
even if application-layer filtering has a bug. See [multi-tenancy.md](./multi-tenancy.md).

## Backend module map

| Module | Responsibility |
|---|---|
| `auth` | login, refresh, logout, password reset, MFA hook, session/token issuance |
| `clinics` | tenant (clinic) CRUD, SUPER_ADMIN only for creation |
| `departments` | clinic sub-units |
| `staff` | staff accounts, invitations, role assignment |
| `doctors` | doctor profiles, specialties |
| `patients` | patient records, minimal-PII profile |
| `appointments` | booking, rescheduling, cancellation, status machine |
| `availability` | doctor working hours / slot generation |
| `medical-records` | encounter records, tightly scoped access |
| `treatment-notes` | clinical notes attached to a record/encounter |
| `documents` | secure upload/download, signed URLs |
| `billing` | invoices, line items, payment status (no card data stored) |
| `notifications` | in-app + email/WebSocket notifications, queued via BullMQ |
| `audit-log` | append-only audit trail, redacted, queried by SUPER_ADMIN/CLINIC_ADMIN |
| `data-export` | patient/clinic data export (portability), async job |
| `deletion-requests` | right-to-erasure workflow with approval + retention hold |

Cross-cutting: `common/guards`, `common/interceptors`, `common/decorators`,
`common/filters` (problem+json error shape), `redis`, `queue` (BullMQ),
`storage` (S3-compatible object storage abstraction), `websocket` gateway.

## Frontend shape

Next.js App Router, route groups per role area (`(auth)`, `(dashboard)`),
server components for initial data, TanStack Query for client-side mutation/
cache management, React Hook Form + Zod (schemas shared with backend via
`packages/shared`) for all forms, shadcn/ui for the component layer, Tailwind
for styling. Auth state via httpOnly cookies (access + refresh), never
localStorage, to keep tokens out of reach of XSS.

## Why these stack choices (brief)

- **Prisma + PostgreSQL**: strong relational integrity for clinical data,
  native RLS support for defense-in-depth tenant isolation, mature migration
  tooling.
- **Redis + BullMQ**: rate limiting counters, session/refresh-token
  denylist, and async job processing (notifications, exports, document
  virus-scan hooks) without blocking request threads.
- **NestJS**: structured DI, first-class guards/interceptors pipeline that
  maps cleanly onto the RBAC + tenant-isolation + audit requirements.
- **Zod (shared package)**: one schema definition validated on both the
  Next.js form layer and the NestJS DTO layer, avoiding drift.

## Environments

Local dev: Docker Compose (Postgres, Redis, MinIO for S3-compatible storage,
Mailhog for email capture). CI: same compose stack, ephemeral. Production:
container images built in CI, deployed behind a reverse proxy terminating TLS;
out of scope for this repo (infra-as-code for a specific cloud is not
included — see `docs/deployment.md` placeholder for what a target environment
must provide).
