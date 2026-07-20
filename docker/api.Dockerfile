# SEO Guardian — API image (Render-compatible).
#
# Render's Blueprint spec has no `dockerTarget` field, so it always builds a
# Dockerfile's LAST stage. The root ./Dockerfile is a single multi-target file
# (`--target api|worker|web`) which Render therefore cannot select from; these
# per-service files exist so each image's final stage IS the service. Keep them
# in step with the root Dockerfile when dependencies change.
#
# BuildKit-only syntax (`# syntax=`, `--mount=type=cache`) is deliberately
# avoided here so the build works on any builder Render happens to use.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0
RUN corepack enable
WORKDIR /app

# --- deps: manifests only, so the install layer survives source edits --------
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
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile

# --- build: compile, then flatten to a self-contained prod tree -------------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm build --filter=@seo-guardian/api \
    && pnpm --filter=@seo-guardian/api deploy --prod --legacy /out

# --- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    API_PORT=10000

# The API image also carries the migrator: Render runs migrations as this
# service's preDeployCommand, and `pnpm deploy --prod` strips node-pg-migrate
# (a devDependency of @seo-guardian/db). Installing it globally keeps the
# runtime tree prod-only while still making the binary available.
RUN npm install -g node-pg-migrate@7.9.1 pg@8.16.0 \
    && npm cache clean --force

COPY --from=build --chown=node:node /out /app
# Migrations are plain .sql and are not part of the compiled output.
COPY --chown=node:node packages/db/migrations /app/migrations

USER node
EXPOSE 10000
CMD ["node", "dist/main.js"]
