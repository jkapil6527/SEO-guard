# SEO Guardian — worker image (Render-compatible).
#
# See docker/api.Dockerfile for why these per-service files exist.
#
# This image carries a real Chromium via Playwright, so it is much larger than
# the other two and needs ~2GB RAM at runtime. Render's free tier does not offer
# background workers at all; this must run on a paid instance.

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
# Browsers are installed in the runtime stage against the resolved Playwright
# version, not here.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile

# --- build ------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm build --filter=@seo-guardian/worker \
    && pnpm --filter=@seo-guardian/worker deploy --prod --legacy /out

# --- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=build --chown=node:node /out /app

# `--with-deps` pulls the apt libraries Chromium needs. Both the browser and
# those libraries must land before the USER switch so `node` can read them.
RUN node_modules/.bin/playwright install --with-deps chromium \
    && chmod -R 755 /ms-playwright \
    && rm -rf /var/lib/apt/lists/*

USER node
CMD ["node", "dist/main.js"]
