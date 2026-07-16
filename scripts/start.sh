#!/usr/bin/env bash
#
# One-command bootstrap for SEO Guardian AI.
#   pnpm start   (or: bash scripts/start.sh)
#
# Brings up infrastructure (Postgres, Redis, MinIO, MailHog), prepares the
# environment, applies migrations, seeds the first super-admin, and runs the
# API, worker and web app together in watch mode.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

log() { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ---- prerequisites -------------------------------------------------------
command -v pnpm >/dev/null 2>&1 || die "pnpm not found. Run: corepack enable"
command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker to run the infrastructure."
docker compose version >/dev/null 2>&1 || die "docker compose v2 not available."
docker info >/dev/null 2>&1 || die "Cannot talk to the Docker daemon. Is it running / are you in the 'docker' group?"

# ---- environment ---------------------------------------------------------
if [ ! -f .env ]; then
  log "Creating .env from .env.example (edit it to set a real JWT_ACCESS_SECRET for anything non-local)"
  cp .env.example .env
fi
set -a; . ./.env; set +a

# ---- infrastructure ------------------------------------------------------
log "Starting infrastructure (Postgres, Redis, MinIO, MailHog)…"
docker compose up -d

log "Waiting for PostgreSQL…"
until docker compose exec -T postgres pg_isready -U seo_guardian >/dev/null 2>&1; do sleep 1; done
log "Waiting for Redis…"
until docker compose exec -T redis redis-cli ping >/dev/null 2>&1; do sleep 1; done

# ---- dependencies --------------------------------------------------------
if [ ! -d node_modules ]; then
  log "Installing dependencies…"
  pnpm install
fi

# Clear the Next.js build cache so a stale cache (e.g. references to a removed
# route) can never render a blank screen after code changes.
rm -rf apps/web/.next apps/web/.turbo

# ---- database ------------------------------------------------------------
log "Applying database migrations…"
pnpm db:migrate

# The API seeds its "system" user on boot; no admin/login seeding is needed
# (authentication is disabled in this build).

# ---- run -----------------------------------------------------------------
cat <<EOF

  SEO Guardian AI is starting (authentication disabled — opens straight in).

    Web app     http://localhost:3000
    API         http://localhost:${API_PORT:-4000}/api/v1
    Swagger     http://localhost:${API_PORT:-4000}/api/v1/docs
    MinIO       http://localhost:9001   MailHog  http://localhost:8025

    Press Ctrl+C to stop the apps (infra keeps running; 'pnpm stop' tears it down).

EOF

log "Launching API + worker + web (watch mode)…"
exec pnpm dev
