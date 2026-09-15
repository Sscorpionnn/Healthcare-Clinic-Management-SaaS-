# Deployment

This repository ships application code, container images, and a local
Docker Compose stack for development — it does not ship infrastructure-as-
code for a specific cloud provider. That's a deliberate boundary (see
`docs/architecture.md` → Environments): the correct target infrastructure
depends on an operator's existing platform, compliance posture, and region
requirements in a way a generic template can't responsibly assume, and
getting Postgres encryption-at-rest, secret management, and network
isolation right is an organizational decision, not a code default.

A production deployment target must provide the following; everything below
maps directly to an assumption made somewhere in `apps/api`, `apps/web`, or
the docs in this directory.

## Required infrastructure

| Requirement | Why | Where it's assumed |
|---|---|---|
| TLS termination in front of both `api` and `web` | cookies are `Secure`; the app never terminates TLS itself | `docs/privacy-model.md` (Encryption), `docs/api-contract.md` |
| PostgreSQL 16+ with encryption at rest and automated backups | primary datastore for all tenant/clinical data | `packages/database/prisma/schema.prisma` |
| A database role separate from the migration/admin role, provisioned via `packages/database/prisma/roles.sql`, with Row-Level Security applied via `rls.sql` | tenant isolation's second enforcement layer | `docs/multi-tenancy.md` |
| Redis (managed or self-hosted, persistence not required) | rate limiting, refresh-token/session bookkeeping, BullMQ queues | `docs/architecture.md` |
| S3-compatible object storage with private-by-default buckets and signed-URL support | document storage | `docs/document-security.md` |
| A secret manager (cloud-native KMS/secrets service, or at minimum environment injection that never touches the container image or source control) | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, `FIELD_ENCRYPTION_KEY`, storage/database credentials | `.env.example` (names only — no real values ever committed) |
| Outbound SMTP relay | invite emails, password resets, notification emails | `.env.example` (`SMTP_*`) |
| Container registry + runtime that can run the images built from `apps/api/Dockerfile` and `apps/web/Dockerfile` | both images are standard multi-stage, non-root, health-checked OCI images — any conformant runtime (ECS, Cloud Run, Kubernetes, etc.) works | `apps/api/Dockerfile`, `apps/web/Dockerfile` |

## Configuration

All runtime configuration is environment variables — see `.env.example` for
the full list and inline documentation of each. None of them have safe
production defaults baked into the app; every secret-shaped value must be
supplied by the deployment environment.

## Release process (assumed, not enforced by this repo)

1. CI (`.github/workflows/ci.yml`) passes on the target commit: lint,
   typecheck, unit + integration tests (including the tenant-isolation/IDOR
   suite), Playwright E2E, and both app builds succeed.
2. `.github/workflows/security.yml` passes: no unresolved `HIGH`/`CRITICAL`
   dependency or image vulnerabilities, no secrets detected.
3. Images are built and pushed to the operator's registry, tagged by commit
   SHA.
4. Database migrations (`prisma migrate deploy`) run against production
   before the new API image receives traffic; RLS/role SQL
   (`roles.sql`/`rls.sql`) is applied once per environment by an operator
   with elevated database access, not by the application's own runtime role.
5. Rolling deploy of `api` then `web` behind the TLS-terminating reverse
   proxy/load balancer.

## What this repo explicitly does not provide

- Terraform/Pulumi/CloudFormation or any cloud-specific IaC.
- A CDN or edge-caching configuration for `web`.
- Log aggregation / APM wiring beyond structured stdout logging (the app
  logs JSON lines; shipping them to a log platform is an infra concern).
- Any AI/LLM service integration or dependency — none exists in this
  product, so no such infrastructure is needed.
