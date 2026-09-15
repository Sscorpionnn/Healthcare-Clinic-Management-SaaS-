# syntax=docker/dockerfile:1
# Multi-stage build for the NestJS API. Build context is the repo root
# (pnpm workspace) — see docker-compose.yml.

FROM node:24.1.0-alpine3.20 AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

# ---- deps: install with workspace-aware caching -----------------------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc* ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build: compile TS, generate Prisma client -------------------------
FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY packages/database packages/database
COPY apps/api apps/api
RUN pnpm --filter @clinic/database run generate
RUN pnpm --filter api run build
# Trim devDependencies out of the workspace node_modules for the runtime image.
RUN pnpm deploy --filter=api --prod /repo/deploy/api

# ---- runtime: minimal, non-root ----------------------------------------
FROM node:24.1.0-alpine3.20 AS runtime
RUN apk add --no-cache dumb-init \
 && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /repo/deploy/api ./
COPY --from=build --chown=app:app /repo/apps/api/dist ./dist
COPY --from=build --chown=app:app /repo/packages/database/generated ./packages/database/generated
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/api/v1/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
