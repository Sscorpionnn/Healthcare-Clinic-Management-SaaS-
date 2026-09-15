# Security Policy

## Reporting a vulnerability

If you believe you've found a security vulnerability in this project,
please report it privately rather than opening a public issue.

- Email: **security@example.com** (replace with your organization's real
  security contact before deploying this project)
- Include: a description of the issue, steps to reproduce, affected
  version/commit, and potential impact.
- Please give a reasonable amount of time to investigate and remediate
  before any public disclosure.

We aim to acknowledge reports within 3 business days.

## Scope

This is a multi-tenant clinic management platform. Reports of particular
interest:

- Cross-tenant data access (any way to read, modify, or infer another
  clinic's data)
- Authentication/authorization bypass or privilege escalation
- IDOR on any resource endpoint
- Injection (SQL, NoSQL, command, etc.)
- Document upload/storage abuse (path traversal, content-type spoofing,
  access-control bypass on stored files)
- Secrets or credentials exposed in the repository, build artifacts, or
  container images

Out of scope: findings that require physical access to a user's device,
social engineering, or denial-of-service via sheer volume (rate limiting is
implemented but not tuned for adversarial load testing).

## Security posture

The technical controls this project implements are documented in detail in
[`docs/threat-model.md`](docs/threat-model.md), with supporting design docs:

- [`docs/multi-tenancy.md`](docs/multi-tenancy.md) — tenant isolation (two
  independent enforcement layers: application scoping + Postgres RLS)
- [`docs/rbac.md`](docs/rbac.md) — role-based access control
- [`docs/privacy-model.md`](docs/privacy-model.md) — data minimization,
  encryption, data-subject rights
- [`docs/document-security.md`](docs/document-security.md) — file upload
  validation and storage
- [`docs/test-strategy.md`](docs/test-strategy.md) — the automated security
  test suite that runs on every change

## Supported versions

This project does not yet have a stable release line; security fixes are
applied to the `main` branch. Once versioned releases exist, this section
will list which are actively supported.

## No real data

This repository contains no real patient, staff, or organizational data —
all seed/demo data is synthetic (see the seed script in
`packages/database/prisma/seed.ts`). Do not add real personal or health data
to this repository, including in issues, pull requests, or test fixtures.
