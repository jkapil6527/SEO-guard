# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the SEO Guardian monorepo. One file, three runnable
# targets — select with `--target api|worker|web`.
#
#   docker build --target api    -t seo-guardian-api .
#   docker build --target worker -t seo-guardian-worker .
#   docker build --target web    -t seo-guardian-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
#
# `web` bakes NEXT_PUBLIC_API_URL in at build time; the other two read all
# config from the environment at boot.

# ---------------------------------------------------------------------------
# base — pnpm via corepack, pinned by the root packageManager field
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — manifests only, so an install layer survives any source edit
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/config/package.json packages/config/
COPY packages/crawler-core/package.json packages/crawler-core/
COPY packages/db/package.json packages/db/
COPY packages/schema-engine/package.json packages/schema-engine/
COPY packages/seo-engine/package.json packages/seo-engine/
COPY packages/shared/package.json packages/shared/
# Browsers come from the worker target's own install step, against the exact
# playwright version the lockfile resolves.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# source — shared source layer; each build-* target compiles only its own app
# (turbo's ^build pulls in just that app's workspace deps)
# ---------------------------------------------------------------------------
FROM deps AS source
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .

# ---------------------------------------------------------------------------
# build-* — compile, then `pnpm deploy` flattens the app plus its workspace
# deps into a self-contained tree with prod-only node_modules
# ---------------------------------------------------------------------------
FROM source AS build-api
RUN pnpm build --filter=@seo-guardian/api \
    && pnpm --filter=@seo-guardian/api deploy --prod --legacy /out

FROM source AS build-worker
RUN pnpm build --filter=@seo-guardian/worker \
    && pnpm --filter=@seo-guardian/worker deploy --prod --legacy /out

FROM source AS build-web
# Baked into the client bundle at compile time — a runtime env var cannot
# change it, so the URL must be correct here or the dashboard ships pointing
# at localhost.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# `output: 'standalone'` already emits a traced bundle, so no pnpm deploy here.
RUN pnpm build --filter=@seo-guardian/web

# ---------------------------------------------------------------------------
# migrate — node-pg-migrate against DATABASE_URL. Point this at Neon's DIRECT
# (unpooled) URL: migrations take advisory locks and run DDL, which PgBouncer
# in transaction mode breaks.
#
# Deployed without --prod on purpose: node-pg-migrate is a devDependency of
# @seo-guardian/db, and --prod would strip the very binary this stage runs.
# ---------------------------------------------------------------------------
FROM source AS build-migrate
RUN pnpm build --filter=@seo-guardian/db \
    && pnpm --filter=@seo-guardian/db deploy --legacy /out

FROM base AS migrate
ENV NODE_ENV=production
COPY --from=build-migrate --chown=node:node /out /app
USER node
CMD ["node_modules/.bin/node-pg-migrate", "up", "-m", "migrations", "--migration-filename-format", "utc"]

# ---------------------------------------------------------------------------
# api — NestJS REST API
# ---------------------------------------------------------------------------
FROM base AS api
ENV NODE_ENV=production \
    API_PORT=10000
COPY --from=build-api --chown=node:node /out /app
USER node
EXPOSE 10000
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# worker — BullMQ processors; drives a real Chromium via Playwright, so this
# target carries the browser and its shared libraries.
# ---------------------------------------------------------------------------
FROM base AS worker
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=build-worker --chown=node:node /out /app
# --with-deps pulls the apt libraries Chromium needs; both it and the browser
# itself must land before the USER switch so `node` can read them.
RUN node_modules/.bin/playwright install --with-deps chromium \
    && chmod -R 755 /ms-playwright \
    && rm -rf /var/lib/apt/lists/*
USER node
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# web — Next.js dashboard
# ---------------------------------------------------------------------------
FROM base AS web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The standalone bundle mirrors the workspace layout, so the server lives at
# apps/web/server.js and carries its own minimal node_modules.
COPY --from=build-web --chown=node:node /app/apps/web/.next/standalone /app
# Static assets are not traced into the bundle; they must be laid in by hand.
COPY --from=build-web --chown=node:node /app/apps/web/.next/static /app/apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
