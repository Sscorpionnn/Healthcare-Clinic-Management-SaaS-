# Clinic Management SaaS

A multi-tenant, privacy-first platform for clinics to manage patients,
doctors, appointments, medical records, documents, and billing — with
tenant isolation, role-based access control, and document security treated
as first-class requirements rather than afterthoughts.

> **No real data.** This repository contains no real patient, staff, or
> organizational data anywhere — configuration is placeholders only
> (`.env.example`), and all seed/demo data is synthetically generated (see
> `packages/database/prisma/seed.ts`). Do not add real personal or health
> data to this repository.

## Why this exists

Clinic operations software sits on top of some of the most sensitive data
categories that exist (health records) inside a structure (multi-tenant
SaaS) that is notoriously easy to get wrong (cross-tenant data leaks). This
project treats that combination as the design constraint from the start:
every tenant-scoped table is protected by two independent enforcement
layers (application-level scoping *and* PostgreSQL row-level security), role
permissions are data-driven and enforced server-side, and file uploads go
through a validate-then-promote pipeline rather than being trusted on
arrival. See [`docs/`](docs/) for the full design record.

## Documentation

| Doc | Covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System shape, module map, stack rationale |
| [`docs/multi-tenancy.md`](docs/multi-tenancy.md) | Tenant isolation model (app + RLS layers), IDOR prevention |
| [`docs/rbac.md`](docs/rbac.md) | Roles, permission matrix, privilege-escalation prevention |
| [`docs/privacy-model.md`](docs/privacy-model.md) | Data minimization, encryption, data-subject rights |
| [`docs/document-security.md`](docs/document-security.md) | Upload validation, storage, signed URLs |
| [`docs/threat-model.md`](docs/threat-model.md) | STRIDE-based threat catalog and mitigations |
| [`docs/test-strategy.md`](docs/test-strategy.md) | Test levels, the mandatory IDOR suite, CI gates |
| [`docs/api-contract.md`](docs/api-contract.md) | REST API surface, auth/session/CSRF model |
| [`docs/deployment.md`](docs/deployment.md) | What a production environment must provide |

## Stack

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui,
  TanStack Query, React Hook Form + Zod
- **Backend**: NestJS, PostgreSQL + Prisma, Redis, BullMQ, WebSocket gateway
- **Shared**: a `packages/shared` package holding Zod schemas and the RBAC
  permission matrix as data, consumed by both apps so validation/authorization
  rules are defined once
- **Tooling**: Docker, GitHub Actions, Jest, Supertest, Playwright, gitleaks

See [`docs/architecture.md`](docs/architecture.md) for the reasoning behind
these choices.

## Repository layout

```
apps/
  api/        NestJS backend
  web/        Next.js frontend
packages/
  database/   Prisma schema, RLS policies, migrations, synthetic seed data
  shared/     Zod schemas, RBAC permission matrix, password hashing
  config/     Shared ESLint/TypeScript config
docs/         Architecture, security, and process documentation
```

## Quickstart (local development)

Requires Node 20+, pnpm 9+, and Docker.

```bash
cp .env.example .env            # edit values if you want non-default local secrets

pnpm install

docker compose up -d postgres redis minio mailhog

pnpm db:migrate
pnpm --filter @clinic/database run roles:apply   # creates the clinic_app / clinic_platform DB roles
pnpm --filter @clinic/database run rls:apply      # applies row-level security policies
pnpm db:seed                                       # synthetic demo clinics, staff, and patients

pnpm dev                                            # runs api (http://localhost:4000) + web (http://localhost:3000)
```

The seed script prints demo login credentials for each role after it runs —
all accounts share one demo password, and every email address uses the
reserved `example.test` domain.

To run the fully containerized stack instead (API and web as built images):

```bash
docker compose --profile full up -d --build
```

## Testing

```bash
pnpm test                                   # unit tests, all packages
pnpm --filter api run test:integration      # API integration tests incl. tenant-isolation/IDOR suite
pnpm --filter api run test:security         # dedicated security test suite (see docs/test-strategy.md)
pnpm test:e2e                               # Playwright end-to-end
```

## Security scanning

```bash
gitleaks detect --config .gitleaks.toml     # secret scan
pnpm audit --audit-level=high               # dependency audit
```

Both also run in CI on every push/PR via
[`.github/workflows/security.yml`](.github/workflows/security.yml), along
with a Trivy scan of the built container images.

## License

MIT — see [`LICENSE`](LICENSE).
