# Test Strategy

## Levels

| Level | Tool | Scope |
|---|---|---|
| Unit | Jest | guards, policies, services (business logic), Zod schemas, utility/crypto helpers |
| Integration | Jest + Supertest | full HTTP pipeline against a real Postgres (Dockerized) — auth flows, tenant isolation, RBAC, IDOR |
| E2E | Playwright | critical user journeys through the actual Next.js UI against the actual API |
| Security | Jest + Supertest (dedicated suite), CI tools | see below |
| Static | ESLint, TypeScript strict mode, gitleaks, dependency audit | every push |

## Tenant isolation & IDOR suite (mandatory, blocks merge)

For every resource type with an `:id` route param, the suite:

1. Seeds two clinics (`A`, `B`) each with a full set of users across all
   roles and their own patients/appointments/records/documents.
2. As every role in clinic `A`, attempts to read/update/delete every
   resource `id` that actually belongs to clinic `B`.
3. Asserts `404` (not `403`, to avoid existence leakage) for every one of
   those attempts, and that no response body contains any clinic-`B` field
   value.
4. Additionally, within clinic `A`, attempts the same matrix *across roles*
   (e.g. `RECEPTIONIST` fetching a `MedicalRecord`, `NURSE` writing a
   restricted field) and asserts the RBAC/PolicyGuard rejection.

This suite is generated from the shared route/resource registry so a newly
added endpoint is included automatically rather than requiring someone to
remember to add a case.

## Security test suite

| Threat | Test approach |
|---|---|
| SQL injection | parameterized payload fuzz against every query-param/body string field; assert no 500/ORM error leak and no unauthorized data returned |
| XSS | inject `<script>`/event-handler payloads into every text field; assert stored value round-trips escaped and CSP header is present on all HTML responses |
| CSRF | mutating request without CSRF token/with mismatched `Origin` is rejected |
| SSRF | any endpoint accepting a URL-shaped field is asserted to reject private/link-local addresses |
| Auth bypass | protected routes without/with expired/with tampered-signature JWT all return 401; `@Public()` routes are enumerated and diffed against an allowlist so a route can't silently become public |
| Role escalation | attempt to set `role`/`clinicId` via mass assignment on every writable DTO; assert rejected or ignored |
| Account enumeration | compare response shape/timing for existing vs non-existing accounts on login/register/reset |
| Brute force / rate-limit | scripted burst of login attempts asserts lockout/backoff kicks in at the configured threshold |
| File upload abuse | polyglot files, mismatched-extension files, oversized files, disallowed types — all assert rejection before the object is promoted out of quarantine |

## CI gates (must pass to merge)

1. Lint + typecheck (both apps)
2. Unit tests
3. Integration tests (incl. tenant isolation/IDOR suite) against ephemeral
   Postgres/Redis
4. Security test suite
5. `gitleaks detect`
6. Dependency audit (`pnpm audit --audit-level=high`, GitHub Dependency
   Review on PRs)
7. Docker image build + Trivy scan (no `HIGH`/`CRITICAL` unresolved)
8. Playwright E2E smoke (login, book appointment, upload document, view
   audit log) — runs against a docker-compose stack

## Coverage expectations

Unit + integration coverage enforced via CI threshold on `common/` (guards,
interceptors, policies) and every module's `service`/`policy` files —
these are the highest-consequence code paths. Controllers and DTO
boilerplate are exercised via integration tests rather than chased for unit
coverage percentage for its own sake.
