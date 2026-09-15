# RBAC Model

## Roles

| Role | Scope | Summary |
|---|---|---|
| `SUPER_ADMIN` | platform | Manages clinics/tenants, platform health, never touches clinical content directly |
| `CLINIC_ADMIN` | clinic | Full administrative control within one clinic |
| `DOCTOR` | clinic | Clinical staff; own patients' records, own appointments/availability |
| `NURSE` | clinic | Clinical support; read/limited-write on records under supervision |
| `RECEPTIONIST` | clinic | Scheduling, patient intake (non-clinical fields only) |
| `BILLING_MANAGER` | clinic | Billing/invoices only; no clinical record access |
| `PATIENT` | self | Own profile, own appointments, own documents, own billing |

A user has exactly one role per clinic membership; a person who is staff at
two clinics has two separate memberships (separate rows), never a merged
cross-tenant identity.

## Enforcement mechanism

Two-layer guard pipeline after `TenantGuard`:

1. **`RolesGuard`** — coarse check via `@Roles(...)` decorator on the route:
   does this role even have access to this endpoint category.
2. **`PolicyGuard`** — fine-grained, resource-aware check via
   `@CheckPolicy((ability, ctx) => ...)`, e.g. a `DOCTOR` may read a
   `MedicalRecord` only if they are the assigned doctor on that record's
   encounter (or hold an explicit care-team grant), not merely "any doctor in
   the clinic."

Permission matrix lives in `packages/shared/src/rbac/permissions.ts` as data
(not scattered `if` statements), consumed by both the NestJS `PolicyGuard`
and the Next.js UI (to hide actions a role can't perform — UI hiding is a UX
convenience, never a substitute for the server-side check).

## Permission matrix (summary)

| Resource | SUPER_ADMIN | CLINIC_ADMIN | DOCTOR | NURSE | RECEPTIONIST | BILLING_MANAGER | PATIENT |
|---|---|---|---|---|---|---|---|
| Clinic settings | manage (own actions audited) | manage | - | - | - | - | - |
| Staff accounts | - | manage | - | - | - | - | - |
| Patients | - | manage | read/write assigned | read assigned | create/read (non-clinical fields) | read (billing-relevant fields only) | read/write self |
| Appointments | - | manage | manage own | read assigned | manage | read | manage own |
| Medical records | - | read (compliance only, audited) | manage own patients | read assigned, write vitals only | - | - | read own |
| Treatment notes | - | - | manage own | read assigned | - | - | read own |
| Documents | - | manage (non-clinical) | manage own patients' | read assigned | upload intake docs | read billing docs | manage own |
| Billing | - | manage | - | - | - | manage | read own |
| Notifications | - | clinic-wide send | send to own patients | - | send scheduling notices | send billing notices | read own |
| Audit logs | platform-wide read | clinic-scoped read | - | - | - | - | - |
| Data export | - | request for clinic | - | - | - | - | request own |
| Deletion requests | approve (platform policy) | approve (clinic policy) | - | - | - | - | request own |

Notes:
- `CLINIC_ADMIN` reading medical records is logged with elevated severity in
  the audit trail and intended for compliance investigations, not routine use
  — this is a deliberate friction point, not an oversight.
- `NURSE` write access to records is restricted to a narrow field allowlist
  (vitals, intake notes) enforced by DTO shape, not just UI.
- `BILLING_MANAGER` never receives clinical fields in any response DTO — this
  is enforced by using billing-specific response projections, not by trusting
  the client to ignore extra fields.

## Mass-assignment prevention

Every write endpoint uses an explicit `class-validator` DTO with
`whitelist: true, forbidNonWhitelisted: true` on the global `ValidationPipe`.
Fields like `role`, `clinicId`, `id`, `status` (where state-machine-controlled)
are never part of a user-writable DTO — they're set server-side or transitioned
through dedicated state-transition endpoints (e.g.
`POST /appointments/:id/cancel`, not `PATCH /appointments/:id { status }`).

## Privilege escalation prevention

- Role changes on a staff account require `CLINIC_ADMIN` and target a
  different user than the actor (no self-promotion).
- A `CLINIC_ADMIN` cannot grant `SUPER_ADMIN` — that role is assignable only
  via a separate platform-operator process outside the standard staff API.
- JWT role/clinic claims are re-validated against the DB on every request for
  sensitive operations (not just trusted from token) to close the window
  where a role change should immediately revoke old privileges; access tokens
  are short-lived (15 min) specifically to bound this window for the
  lower-risk endpoints that don't re-check.
