# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js frontend. Build context is the repo
# root (pnpm workspace) — see docker-compose.yml. Assumes next.config.*
# sets `output: "standalone"`.

FROM node:24.1.0-alpine3.20 AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

# ---- deps ----------------------------------------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc* ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build -----------------------------------------------------------------
FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web run build

# ---- runtime: minimal, non-root --------------------------------------------
FROM node:24.1.0-alpine3.20 AS runtime
RUN apk add --no-cache dumb-init \
 && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
