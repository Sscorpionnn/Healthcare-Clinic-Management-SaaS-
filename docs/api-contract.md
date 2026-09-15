# API Contract (v1)

Base path: `/api/v1`. JSON only (`Content-Type: application/json`), except
document upload completion which references storage out-of-band (see
[document-security.md](./document-security.md)).

## Auth & session

- Access/refresh tokens are issued as `httpOnly`, `Secure` (in non-local
  envs), `SameSite=Strict` cookies: `access_token` (15 min), `refresh_token`
  (7 days, rotated on every use, reuse triggers full family revocation).
- A third, **non-httpOnly** cookie `csrf_token` is set alongside them. Every
  mutating request (`POST`/`PATCH`/`PUT`/`DELETE`) must echo its value in an
  `X-CSRF-Token` header — classic double-submit CSRF defense. The API also
  validates `Origin`/`Referer` against `CORS_ORIGIN` as defense in depth.
- JWT payload: `{ sub: userId, membershipId, clinicId, role, isSuperAdmin, iat, exp }`.
  `clinicId`/`role` are absent for a `SUPER_ADMIN` platform-scoped token.

| Method & path | Auth | Body | Notes |
|---|---|---|---|
| `POST /auth/login` | none | `{ email, password }` | Rate-limited (see threat-model T4). If the user has exactly one `ACTIVE` membership (or is `SUPER_ADMIN`), returns full session cookies + `{ user }`. If multiple, returns `{ requiresClinicSelection: true, memberships: [{ membershipId, clinicId, clinicName, role }] }` and a short-lived (5 min) `preauth_token` cookie. |
| `POST /auth/select-clinic` | `preauth_token` cookie | `{ membershipId }` | Issues full session cookies for the chosen membership. |
| `POST /auth/refresh` | `refresh_token` cookie | — | Rotates refresh token; detects reuse of a revoked token and revokes the entire token family (session hijack containment). |
| `POST /auth/logout` | access token | — | Revokes current refresh token, clears cookies. |
| `POST /auth/invite/accept` | none | `{ token, password }` | Activates an invited membership, sets password, logs the user in. |
| `POST /auth/password-reset/request` | none | `{ email }` | Always `202`, identical response regardless of whether the email exists (T5). |
| `POST /auth/password-reset/confirm` | none | `{ token, password }` | Invalidates all existing refresh tokens for the user. |
| `GET /auth/me` | access token | — | Current user + membership summary. |

## Resource routes (representative; full set mirrors the module list in
docs/architecture.md, each following the same shape)

All list endpoints are paginated: `?page=1&pageSize=20` (`pageSize` capped
at 100), response shape `{ data: T[], page, pageSize, total }`.

All entity routes are implicitly clinic-scoped from the authenticated
token — **never** from a path/query `clinicId` param, which does not exist
on any tenant-data route. A `SUPER_ADMIN` uses separate `/admin/*` routes.

| Resource | Routes |
|---|---|
| Clinics (platform) | `POST /admin/clinics`, `GET /admin/clinics`, `GET /admin/clinics/:id`, `PATCH /admin/clinics/:id`, `POST /admin/clinics/:id/suspend` — `SUPER_ADMIN` only |
| Departments | `GET/POST /departments`, `GET/PATCH/DELETE /departments/:id` |
| Staff | `GET /staff`, `POST /staff/invite`, `PATCH /staff/:membershipId/role`, `POST /staff/:membershipId/suspend` |
| Doctors | `GET /doctors`, `GET /doctors/:id`, `PATCH /doctors/:id` |
| Availability | `GET/POST /doctors/:id/availability`, `DELETE /doctors/:id/availability/:slotId`, `GET /doctors/:id/available-slots?date=` (computed) |
| Patients | `GET/POST /patients`, `GET/PATCH /patients/:id`, `DELETE /patients/:id` (soft delete, triggers deletion-request flow, not a hard delete) |
| Appointments | `GET/POST /appointments`, `GET /appointments/:id`, `POST /appointments/:id/confirm`, `POST /appointments/:id/check-in`, `POST /appointments/:id/complete`, `POST /appointments/:id/cancel`, `PATCH /appointments/:id/reschedule` |
| Medical records | `GET/POST /medical-records`, `GET /medical-records/:id`, `POST /medical-records/:id/finalize` |
| Treatment notes | `GET/POST /medical-records/:id/notes` |
| Documents | `POST /documents/upload-intent`, `POST /documents/:id/complete`, `GET /documents/:id/download-url`, `GET /documents`, `DELETE /documents/:id` |
| Billing | `GET/POST /invoices`, `GET /invoices/:id`, `POST /invoices/:id/payments` |
| Notifications | `GET /notifications`, `POST /notifications/:id/read` |
| Audit logs | `GET /audit-logs` (`CLINIC_ADMIN`: own clinic; `SUPER_ADMIN`: `/admin/audit-logs`, platform-level metadata only) |
| Data export | `POST /data-export-requests`, `GET /data-export-requests/:id`, `GET /data-export-requests/:id/download` |
| Deletion requests | `POST /deletion-requests`, `GET /deletion-requests`, `POST /deletion-requests/:id/review` |

State-transition actions (`/confirm`, `/cancel`, `/finalize`, ...) exist
specifically so `status` is never a directly PATCH-able field — see
docs/rbac.md, mass-assignment prevention.

## Error shape

`application/problem+json` (RFC 9457) on every error, e.g.:

```json
{ "type": "about:blank", "title": "Forbidden", "status": 403, "detail": "...", "instance": "/api/v1/patients/…" }
```

No stack traces, ORM error text, or internal identifiers in production
responses (see threat-model T11).

## WebSocket

`wss://.../ws` namespace, same cookie-based auth handshake, join events are
server-validated against the authenticated user's tenant/role — a client
never chooses an arbitrary room name. Used for live notification delivery
and appointment-status updates.
