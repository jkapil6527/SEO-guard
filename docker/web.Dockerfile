# SEO Guardian — Next.js dashboard image (Render-compatible).
#
# See docker/api.Dockerfile for why these per-service files exist.
#
# IMPORTANT — NEXT_PUBLIC_API_URL is compiled into the client bundle. The
# browser calls the API directly, so this value must be the API's PUBLIC url and
# it must be correct at BUILD time; setting it as a runtime env var on Render
# does nothing. Render also does not pass build args to Docker builds, so the
# ARG default below is what actually ships.
#
# Change the default here (and redeploy) if you rename the API service or move
# it to a custom domain.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0
RUN corepack enable
WORKDIR /app

# --- deps -------------------------------------------------------------------
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

# --- build ------------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=https://seo-guardian-api.onrender.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm build --filter=@seo-guardian/web

# --- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=10000 \
    HOSTNAME=0.0.0.0

# `output: 'standalone'` traces a self-contained server that mirrors the
# workspace layout, so the entrypoint lives at apps/web/server.js.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone /app
# Static assets are not traced into the bundle and must be laid in by hand.
COPY --from=build --chown=node:node /app/apps/web/.next/static /app/apps/web/.next/static

USER node
EXPOSE 10000
CMD ["node", "apps/web/server.js"]
