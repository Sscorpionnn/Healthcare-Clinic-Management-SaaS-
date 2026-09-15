# Threat Model (STRIDE-informed)

Scope: multi-tenant clinic management SaaS. Primary assets: patient clinical
data, staff/patient credentials, documents, billing data, tenant isolation
boundary itself.

## Actors

- Anonymous internet user
- Authenticated PATIENT (own data only)
- Authenticated clinic staff (varying roles, one clinic)
- CLINIC_ADMIN (one clinic, elevated)
- SUPER_ADMIN (platform)
- Malicious insider (any authenticated role, acting outside intended scope)
- Compromised dependency / supply chain

## Key threats and mitigations

| # | Threat | STRIDE | Mitigation |
|---|---|---|---|
| T1 | Cross-tenant data read via IDOR (guessed/enumerated ID) | Information Disclosure | UUIDv7 IDs, tenant-scoped queries (app layer) + Postgres RLS (db layer), 404 on cross-tenant access, automated IDOR test suite |
| T2 | Role escalation via mass assignment (`role`/`clinicId` in body) | Elevation of Privilege | `whitelist:true forbidNonWhitelisted:true` DTO validation, server-set fields never in writable DTOs, dedicated state-transition endpoints |
| T3 | Auth bypass via forged/expired/malformed JWT | Spoofing | short-lived signed access tokens, refresh-token rotation with reuse detection, `AuthGuard` on every route by default (opt-in `@Public()`, not opt-out) |
| T4 | Brute force / credential stuffing on login | Spoofing | Redis-backed rate limiting per IP + per account, exponential backoff, generic error messages (no account enumeration), optional MFA hook |
| T5 | Account enumeration via login/signup/password-reset responses or timing | Information Disclosure | identical response shape + near-constant-time response for "user exists" vs "not found" paths, generic messaging |
| T6 | SQL injection | Tampering | Prisma parameterized queries exclusively; no raw string-interpolated SQL; lint rule flags `$queryRawUnsafe` |
| T7 | Stored/reflected XSS | Tampering | React's default escaping, strict CSP (no `unsafe-inline` scripts), DOMPurify for the few rich-text render paths, output-encoding on any HTML email templates |
| T8 | CSRF on state-changing cookie-authenticated routes | Tampering / Spoofing | `SameSite=Strict` cookies + double-submit CSRF token required on all mutating requests; API also validates `Origin`/`Referer` as defense in depth |
| T9 | SSRF via any server-side outbound fetch (e.g. webhook URLs, avatar-by-URL) | Tampering | no user-supplied-URL server-side fetch features in v1 scope; if added, mandatory allowlist + DNS-rebind-safe resolution + block private IP ranges |
| T10 | Malicious file upload (polyglot, executable disguised as document) | Tampering | extension + MIME + magic-byte validation, quarantine-then-promote flow, AV scan hook, never server-side render uploaded content |
| T11 | Sensitive data leakage via verbose error messages/stack traces | Information Disclosure | global exception filter returns a fixed problem+json shape in production, stack traces only in dev, no ORM error passthrough |
| T12 | Sensitive data leakage via audit log itself | Information Disclosure | audit log stores metadata only, never clinical content body (see privacy-model.md) |
| T13 | Rate-limit bypass via distributed IPs / header spoofing | Denial of Service / Spoofing | rate limiting keyed on authenticated user id where available (not just IP), trusted-proxy-only `X-Forwarded-For` handling |
| T14 | Privilege persistence after role change/termination | Elevation of Privilege | short access-token TTL, refresh-token denylist on role change/termination, DB re-check on sensitive ops |
| T15 | Supply-chain compromise via dependency | Tampering | CI dependency audit (`pnpm audit` / GitHub Dependency Review), lockfile committed, Dependabot/renovate config, pinned base images in Docker |
| T16 | Secret leakage into the repo | Information Disclosure | `.env` never committed, `.env.example` only, gitleaks in CI + pre-commit hook, secrets sourced from env/secret manager at runtime |
| T17 | Insecure Docker image (root user, bloated attack surface) | Tampering | multi-stage builds, non-root `USER`, minimal base images, `.dockerignore`, image scan in CI |
| T18 | WebSocket channel used to bypass REST authz | Elevation of Privilege | WS gateway runs the same `AuthGuard`/`TenantGuard`/`RolesGuard` pipeline on connection + per-event, never trusts client-supplied room/channel names without server-side tenant/role check |
| T19 | Notification payload leaking clinical content to an insecure channel (email/push) | Information Disclosure | notifications carry a generic message + deep link only; recipient must authenticate in-app to see actual content |
| T20 | Data export/deletion abused to exfiltrate another tenant's data | Elevation of Privilege / Information Disclosure | export job scoped to the requester's own tenant/identity at job-creation time, re-validated at job-execution time, signed short-TTL download link |

## Out of scope (documented, not solved here)

- Physical/network infra security of the hosting environment.
- TLS certificate management (assumed handled by the deployment target's
  reverse proxy / load balancer).
- Regulatory certification (e.g. formal HIPAA/GDPR audit) — this repo
  implements the technical controls a real deployment would need as a
  foundation, but compliance certification requires organizational/legal
  processes outside a codebase.
