# 08 — Monorepo & Folder Structure

pnpm workspaces + Turborepo. Node 22 LTS, TypeScript strict everywhere.

```
seo-guardian/
├─ package.json / pnpm-workspace.yaml / turbo.json
├─ docker-compose.yml                # postgres, redis, minio, mailhog (dev)
├─ .github/workflows/                # ci: lint → typecheck → test → build; deploy pipelines
├─ docs/                             # these design docs, ADRs (docs/adr/NNNN-*.md)
│
├─ apps/
│  ├─ api/                           # NestJS REST API
│  │  └─ src/
│  │     ├─ main.ts / app.module.ts
│  │     ├─ common/                  # guards (JwtAuthGuard, ProjectRoleGuard), interceptors
│  │     │                           # (audit, serialization), pipes (ZodValidationPipe),
│  │     │                           # problem-details filter, decorators (@ProjectRole)
│  │     ├─ modules/
│  │     │  ├─ auth/                 # controller, service, strategies, refresh rotation
│  │     │  ├─ users/  projects/  websites/  sources/  schedules/
│  │     │  ├─ crawls/               # start/control endpoints, SSE progress, job producer
│  │     │  ├─ pages/  issues/  schema/  duplicates/  changes/
│  │     │  ├─ dashboard/  trends/   # read models over aggregates
│  │     │  ├─ checks/  reports/  notifications/  ai/  audit/
│  │     │  └─ health/
│  │     └─ config/                  # zod-validated env schema
│  │
│  ├─ worker/                        # NestJS standalone (no HTTP) — all BullMQ processors
│  │  └─ src/
│  │     ├─ main.ts                  # role flag: WORKER_QUEUES=fetch,render,… per deployment
│  │     ├─ processors/
│  │     │  ├─ orchestrate/          # url resolution, sitemap diff, fan-out
│  │     │  ├─ fetch/                # conditional GET, SSRF guard, parse, validate, persist
│  │     │  ├─ render/               # playwright pool
│  │     │  ├─ link-check/  finalize/  report/  notify/  ai-explain/  maintenance/
│  │     └─ services/                # persistence writers (batch inserts), counters, storage client
│  │
│  └─ web/                           # Next.js App Router
│     └─ src/
│        ├─ app/                     # routes per 07-frontend.md
│        ├─ components/              # shared domain components (DataTable, TrendChart, …)
│        ├─ features/                # per-screen composition (dashboard/, issues/, schema/, …)
│        ├─ lib/                     # api client (generated types), react-query setup, sse
│        └─ styles/
│
├─ packages/
│  ├─ shared/                        # DTOs, zod schemas, enums, error codes, api types
│  ├─ seo-engine/                    # PURE: checks/, registry, runner, scoring
│  │  └─ src/checks/{meta,headings,images,links,technical}/   # one file per check + fixture tests
│  ├─ schema-engine/                 # PURE: extractors/{jsonld,microdata,rdfa}, vocabulary,
│  │  │                              # rich-results, diff
│  │  └─ packs/                      # vocab-vX.json, profiles-vX.json (versioned rule packs)
│  ├─ crawler-core/                  # fetch client (SSRF-guarded), robots parser, sitemap parser,
│  │                                 # url normalizer, csv parser — I/O primitives, no business rules
│  ├─ db/                            # schema migrations (node-pg-migrate), typed query layer,
│  │                                 # partition maintenance SQL
│  └─ config/                        # shared eslint, tsconfig, prettier presets
│
└─ tooling/
   ├─ scripts/                       # pack generation from schema.org releases, seed, fixtures
   └─ load-tests/                    # k6 scenarios
```

## Dependency rules (enforced via eslint `import/no-restricted-paths` + turbo graph)

```
web  → shared
api  → shared, db, (seo-engine only for catalog seeding)
worker → shared, db, crawler-core, seo-engine, schema-engine
seo-engine / schema-engine → shared only          # never db, never nestjs, never node:net
crawler-core → shared only
shared → nothing internal
```

- **Pure engines stay pure:** CI fails if `seo-engine`/`schema-engine` import anything doing I/O. This is the testability backbone.
- **`db` owns SQL:** apps never write inline SQL; repositories/typed queries live in one place; migrations reviewed like code.
- **Worker deployments differ by env var, not build:** the same image runs as fetch pool or render pool via `WORKER_QUEUES`, keeping ops simple.
- **ADRs:** every decision in doc 02 §3 gets an ADR file when implementation starts; future changes append, never rewrite.
