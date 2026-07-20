# 12 — Deployment (Render + Neon)

Deploys the three services defined in [`render.yaml`](../render.yaml) from
per-service Dockerfiles in [`docker/`](../docker).

## 0. Before you expose anything: authentication

**This build has no authentication.** `CurrentUser` always resolves to a fixed
`SYSTEM_USER`, the role decorators are inert metadata that no guard reads, and
the only global guard is a rate limiter. Every endpoint — including `DELETE` —
is callable by anyone who knows the URL.

The dashboard calls the API from the browser, so the API **cannot** be hidden on
a private network; it has to be internet-facing. Pick one before going live:

| Option | Effort | Notes |
|---|---|---|
| **Cloudflare Access** in front of both services | ~30 min, free | SSO (Google/GitHub), no code changes. Recommended. |
| IP allowlist at the edge | ~15 min | Fine if only ever used from one office network. |
| Implement real auth in-app | weeks | The "Platform foundation" milestone in [10-roadmap-risks.md](10-roadmap-risks.md). |

## 1. Why per-service Dockerfiles

The root [`Dockerfile`](../Dockerfile) is a single multi-target file selected
with `--target api|worker|web`. **Render's Blueprint spec has no `dockerTarget`
field**, so it always builds a Dockerfile's *last* stage. `docker/*.Dockerfile`
therefore each end with their own service as the final stage.

The root Dockerfile still works for local builds and for platforms that do
support `--target` (Fly, Railway). Keep both in step when dependencies change.

## 2. Provision

1. **Neon Postgres** — create a project in the region closest to your Render
   region (`singapore` in `render.yaml`). Copy **both** connection strings:
   - pooled (host contains `-pooler`) → `DATABASE_URL`
   - direct/unpooled → `DIRECT_DATABASE_URL`

   Migrations take advisory locks and run DDL, which a transaction-mode pooler
   breaks — hence the second URL.

2. **Render** — the workspace must be on a paid plan. Background workers are not
   offered on the free tier, and the worker is not optional (see §5).

## 3. Deploy

1. Push `main` to GitHub.
2. Render → **Blueprints** → **New Blueprint Instance** → connect
   `jkapil6527/SEO-guard` → **Apply**.
3. Render prompts for each `sync: false` variable:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** URL (api + worker) |
   | `DIRECT_DATABASE_URL` | Neon **direct** URL (api only) |
   | `CRAWLER_USER_AGENT` | e.g. `SEOGuardianBot/0.1 (+https://yourdomain/bot)` |
   | `S3_*` | leave **empty** to disable HTML archival |

   `REDIS_URL` is wired automatically from the `seo-guardian-redis` instance.

4. The API's `preDeployCommand` runs the migrations before it starts. Watch that
   step in the deploy log — a failure here means the wrong (pooled) URL.

Live URL: `https://seo-guardian-web.onrender.com`.

## 4. Verify

```
curl https://seo-guardian-api.onrender.com/api/v1/health   # {"status":"ok"}
curl https://seo-guardian-api.onrender.com/api/v1/ready    # database + redis ok
```

Then run one small category crawl end to end and confirm it reaches
`completed` — not `finalizing`.

## 5. Operational notes

- **The worker is infrastructure, not just a job runner.** Its 5-minute
  maintenance job provisions monthly table partitions two months ahead
  (`MONTHS_AHEAD = 2`) and re-drives stuck finalizes. If it stays down long
  enough to pass the last partition, writes start failing outright.
- **Redis must be `noeviction`** (set in `render.yaml`). BullMQ keeps job state
  in ordinary keys; under any LRU policy Redis drops them and crawls hang
  mid-run with no error.
- **`NEXT_PUBLIC_API_URL` is compiled into the client bundle** at build time.
  It is the `ARG` default in `docker/web.Dockerfile` — Render does not pass
  build args, so setting it as a runtime env var does nothing. Renaming the API
  service or moving to a custom domain means editing that default and redeploying
  the web service.
- **`RENDER_CONCURRENCY=1`** on a 2GB instance. Each concurrent Chromium context
  costs a few hundred MB; the local default of 2 will OOM.
- **`CRAWLER_ALLOW_PRIVATE_TARGETS` must stay empty.** It bypasses the SSRF
  guard for test fixtures — dangerous generally, more so with an open API.

## 6. Costs

| Service | Plan | ~USD/mo |
|---|---|---|
| worker (Chromium, 2GB) | standard | 25 |
| api | starter | 7 |
| web | starter | 7 |
| redis (key value) | starter | 10 |
| Postgres | Neon free | 0 |

Roughly **$49/mo**. The worker dominates and cannot be trimmed to the free tier.
