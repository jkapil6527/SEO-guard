# SEO Guardian AI

Enterprise SEO monitoring platform: continuous crawling, Technical-SEO and Schema.org
validation, immutable crawl history, regression detection, dashboards and reports.

**Status:** Phase 3 (crawler + Technical-SEO engine) — SSRF-guarded fetcher, robots/sitemap
parsing, crawl orchestration on BullMQ (manual/scheduled/incremental), a pure Technical-SEO
validation engine (42 checks), duplicate & broken-link detection, immutable snapshots,
scoring, and live SSE progress. Builds on the Phase 2 foundation (auth, RBAC, projects/
websites/sources/schedules). Schema.org, dashboards and reports arrive in Phases 4–5.
Design docs live in [docs/](docs/00-overview.md).

## Repository layout

```
apps/
  api/            NestJS REST API (auth, RBAC, CRUD, crawls + SSE, Swagger, queue producers)
  worker/         BullMQ processors: orchestrate → fetch/render → link-check → finalize,
                  scheduler reconciliation, partition maintenance, catalog seeding
  web/            Next.js dashboard
packages/
  shared/         Framework-free enums, constants, queue contract, API types
  db/             SQL migrations, connection pool, repositories (all SQL lives here)
  crawler-core/   Pure I/O primitives: SSRF-guarded fetch, robots, sitemaps, URL normalize
  seo-engine/     Pure Technical-SEO engine: artifact extraction, check registry, scoring
  config/         Shared tsconfig presets
docs/             Architecture & design documents (read 00-overview.md first)
```

## Prerequisites

- Node.js ≥ 22 (`.nvmrc`), pnpm 11 (`corepack enable`)
- Docker + Docker Compose (PostgreSQL 16, Redis 7, MinIO, MailHog)

## Getting started

**One command** — brings up infra, migrates, seeds the admin, and runs everything:

```bash
pnpm start
```

That runs [scripts/start.sh](scripts/start.sh): starts Docker infra (Postgres, Redis,
MinIO, MailHog), waits for it to be healthy, creates `.env` from `.env.example` if
missing, installs deps on first run, applies migrations, seeds the initial super-admin,
then launches the API, worker and web app in watch mode. Stop the apps with `Ctrl+C`;
tear down the infra with `pnpm stop`.

<details><summary>Or run the steps manually</summary>

```bash
pnpm install
docker compose up -d                     # postgres, redis, minio (+ buckets), mailhog
cp .env.example .env                     # then edit JWT_ACCESS_SECRET etc.

pnpm db:migrate                          # apply SQL migrations
pnpm build                               # build all workspaces
node apps/api/dist/seed.js               # create the initial super admin (idempotent)

pnpm dev                                 # api :4000, web :3000, worker — all in watch mode
```

</details>

- Web app: <http://localhost:3000> — opens straight to the dashboard (no login)
- API: <http://localhost:4000/api/v1> · Swagger UI: <http://localhost:4000/api/v1/docs>
- Health probes: `GET /api/v1/health` (liveness), `GET /api/v1/ready` (PG + Redis)
- MinIO console: <http://localhost:9001> · MailHog: <http://localhost:8025>

> **Authentication is disabled in this build.** There is no login, no JWT and no
> per-project RBAC — every API endpoint is open and the dashboard loads directly.
> All actions are attributed to a single seeded "system" user (so `created_by`
> and the audit trail stay intact). Do not expose this deployment publicly.

## Environment

All configuration is environment-driven and validated at boot (zod); see
[.env.example](.env.example) for every variable. The API refuses to start with an
incomplete or invalid environment.

## Commands

| Command                                       | What it does                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                                    | All apps in watch mode (turbo)                                                                                     |
| `pnpm build` / `pnpm lint` / `pnpm typecheck` | Across every workspace                                                                                             |
| `pnpm test`                                   | Unit tests                                                                                                         |
| `pnpm --filter @seo-guardian/api test:int`    | API integration tests — uses `TEST_DATABASE_URL` if set, otherwise boots an embedded PostgreSQL (no Docker needed) |
| `pnpm db:migrate` / `pnpm db:migrate:down`    | Apply / roll back SQL migrations                                                                                   |
| `pnpm format`                                 | Prettier over the repo                                                                                             |

## Testing & CI

- **Unit tests** (`*.spec.ts`, ~285): auth rotation/reuse, RBAC matrix, cron/CSV validation,
  scheduler reconciliation; **crawler-core** (150) — SSRF truth table + real fetch against a
  fixture server, robots/sitemap parsing, redirects, gzip, timeouts; **seo-engine** (88) —
  artifact extraction and every check with pass/fail fixtures, scoring.
- **Integration tests** (`apps/api/test/*.int-spec.ts`) run the real Nest app over HTTP
  against a real migrated PostgreSQL. `platform.int-spec` covers auth/RBAC/CRUD/CSV/audit.
  `pipeline.int-spec` boots the **worker in-process** against Postgres + Redis and drives a
  full crawl of an in-test fixture site, asserting fetch, validation, duplicate detection,
  broken-link detection, scoring and the 404→error path. Postgres is embedded automatically
  when `TEST_DATABASE_URL` is unset; the pipeline suite runs when a `TEST_REDIS_URL` is
  provided (CI service container) and self-skips otherwise.
- **CI** (`.github/workflows/ci.yml`): lint → typecheck → build → unit tests, plus an
  integration job with PostgreSQL + Redis service containers.
- **Hooks:** pre-commit runs lint-staged (eslint + prettier); commit messages follow
  [Conventional Commits](https://www.conventionalcommits.org) (commitlint).

## Crawl pipeline (Phase 3)

A crawl flows through independent BullMQ queues so each stage scales alone:
`crawl-orchestrate` (resolve URL set from sources, fan out) → `page-fetch`
(SSRF-guarded conditional GET → parse → validate → persist snapshot) →
`page-render` (Playwright, only when a site needs JS) → `link-check` (verify unique
outbound targets) → `crawl-finalize` (duplicate detection, broken-link issues, scoring,
aggregates). Live counters and progress stream over SSE at `GET /api/v1/crawls/:id/progress`.
Per-domain politeness is enforced by a Redis rate limiter regardless of worker count;
incremental crawls carry forward unchanged pages via conditional requests + content hashes.
Workers can be split across deployments with `WORKER_QUEUES` (e.g. a dedicated render pool).

## Security model

**Authentication has been removed from this build** — no login, JWT or per-project RBAC;
every endpoint is open. What remains:

- Every create/update/delete is written to `audit_logs`, attributed to the seeded system user.
- A basic per-IP rate limiter; helmet security headers; RFC 7807 error responses.
- The crawler keeps its SSRF protections (DNS-pinned fetch, private-range blocking).

The JWT/RBAC layer (guards, roles, refresh-token rotation) was built in Phase 2 and can be
reintroduced from git history if the platform ever needs to be exposed beyond a trusted
internal network. **Do not deploy this build to a public network.**

## Design documents

Start at [docs/00-overview.md](docs/00-overview.md) — architecture, database, API spec,
crawling pipeline, validation engines, frontend, security, roadmap.
