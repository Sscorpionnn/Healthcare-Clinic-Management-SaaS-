# Contributing

## Branching & pull requests

- Branch off `main`: `feature/<short-description>`, `fix/<short-description>`,
  `security/<short-description>`.
- Keep pull requests scoped to one change; large unrelated diffs slow down
  review of the security-sensitive parts of this codebase in particular.
- Fill in the PR description with what changed and why. If the change
  touches tenant isolation, RBAC, document handling, or auth, say so
  explicitly and note what test coverage was added.

## Required checks before merge

All of the following must pass (enforced by CI, see
`.github/workflows/ci.yml` and `.github/workflows/security.yml`):

1. Lint (`pnpm lint`) and typecheck (`pnpm typecheck`)
2. Unit tests (`pnpm test`)
3. Integration tests, including the tenant-isolation/IDOR suite
   (`pnpm --filter api run test:integration`)
4. Security test suite (`pnpm --filter api run test:security`)
5. Playwright E2E smoke (`pnpm test:e2e`)
6. Secret scan (gitleaks) and dependency audit — no unresolved `HIGH`/
   `CRITICAL` findings

A change that adds a new API endpoint touching a tenant-scoped resource must
also extend the generated tenant-isolation/IDOR test matrix described in
`docs/test-strategy.md`, not just add a happy-path test.

## Commit style

Short, imperative subject line (`Add appointment reschedule endpoint`, not
`Added` or `Adding`); body explains *why* when it isn't obvious from the
diff. No fixup/WIP commits in a PR ready for review — squash locally first.

## Local setup

See the Quickstart in [`README.md`](README.md). In short:

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis minio mailhog
pnpm db:migrate
pnpm --filter @clinic/database run roles:apply
pnpm --filter @clinic/database run rls:apply
pnpm db:seed
pnpm dev
```

## Code review expectations

Reviewers weigh correctness and security over style. Anything touching
`common/guards`, `common/interceptors`, the `auth` module, the `documents`
module, or Prisma tenant-scoping helpers gets read line-by-line, not
skimmed — see `docs/threat-model.md` for what each of those is protecting
against.

## No AI-authored content policy for this repository

Do not include AI/LLM tool references, prompts, or conversation artifacts in
commits, comments, PR descriptions, or documentation in this repository.
Contributions should read as ordinary, professional engineering work.
