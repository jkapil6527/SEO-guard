# 04 — REST API Specification

Base path: `/api/v1`. OpenAPI document auto-generated from NestJS decorators and served at `/api/v1/docs` (non-prod) / exported artifact (prod).

## 1. Conventions

- **Auth:** `Authorization: Bearer <access JWT>` (15 min TTL) + refresh-token rotation via `POST /auth/refresh` (httpOnly cookie for the web app, body token for API clients). All endpoints except `/auth/*` and `/health` require auth; RBAC guard resolves the user's role from `project_members` for any project-scoped route.
- **Envelope:** success → resource or `{ "data": [...], "meta": {...} }`; error → RFC 7807 problem details `{ "type", "title", "status", "detail", "code", "errors": [{field, message}] }` with stable machine-readable `code` (e.g. `CRAWL_ALREADY_RUNNING`).
- **Pagination:** cursor-based for big sets — `?limit=50&cursor=<opaque>`, response `meta: { nextCursor, total? }` (`total` only where cheap). Offset pagination is deliberately unsupported on snapshot-scale tables.
- **Sorting:** `?sort=-severity,url` (leading `-` = desc). **Filtering:** `?filter[severity]=critical,high&filter[checkId]=meta.title.missing&filter[path]=/news/*&filter[schemaType]=Article`. **Search:** `?q=` (URL substring / issue text).
- **Idempotency:** mutating POSTs accept `Idempotency-Key` header (stored 24h).
- **Rate limits:** per-user token bucket; `429` + `Retry-After`.
- **Versioning:** breaking changes → `/api/v2`; additive changes are non-breaking by contract.

## 2. Endpoints

### Auth & users

```
POST   /auth/login                     {email, password} → {accessToken, refreshToken, user}
POST   /auth/refresh                   rotate refresh token
POST   /auth/logout                    revoke session
GET    /me                             current user + memberships
GET    /users                          [super admin] list users
POST   /users                          [super admin] create user
PATCH  /users/:id                      [super admin] update / deactivate
```

### Projects, members, websites, sources, schedules

```
GET    /projects                                    list my projects (+health summary)
POST   /projects                                    create
GET    /projects/:projectId                         detail + settings
PATCH  /projects/:projectId                         update settings
DELETE /projects/:projectId                         soft delete
GET    /projects/:projectId/members                 list
PUT    /projects/:projectId/members/:userId         {role} add/change
DELETE /projects/:projectId/members/:userId         remove
GET    /projects/:projectId/websites                list
POST   /projects/:projectId/websites                create
PATCH  /websites/:websiteId                         update
GET    /websites/:websiteId/sources                 list url sources
POST   /websites/:websiteId/sources                 add (type: sitemap|manual|csv|discovery)
POST   /websites/:websiteId/sources/csv             multipart upload → validated, stored, source created
DELETE /sources/:sourceId
GET    /websites/:websiteId/schedules               list
POST   /websites/:websiteId/schedules               {cron|preset, timezone, mode}
PATCH  /schedules/:scheduleId                       pause/edit
DELETE /schedules/:scheduleId
```

### Crawls (async jobs)

```
POST   /websites/:websiteId/crawls        start crawl {mode: full|incremental, urls?: [...]}
                                          → 202 { crawlId, status:'queued' }
GET    /websites/:websiteId/crawls        history (date, score, stats) — cursor paginated
GET    /crawls/:crawlId                   status + live counters {total, crawled, unchanged, failed, pending}
GET    /crawls/:crawlId/progress          SSE stream of counter updates
POST   /crawls/:crawlId/pause             \
POST   /crawls/:crawlId/resume             } queue-level controls
POST   /crawls/:crawlId/cancel            /
POST   /crawls/:crawlId/retry-failed      re-enqueue failed pages
```

### Pages, issues, schema results

```
GET    /crawls/:crawlId/pages             page explorer; filters: path, status, severity, score range, fetchStatus
GET    /crawls/:crawlId/pages/:pageId     snapshot detail: artifacts, issues, schema entities, history link
GET    /pages/:pageId/history             snapshots of one URL across crawls (title/canonical/score timeline)
GET    /crawls/:crawlId/issues            filters: severity, category, checkId, path, schemaType, assignee, status
GET    /crawls/:crawlId/issues/summary    counts by check/severity/category (drives dashboard drill-down)
GET    /crawls/:crawlId/schema            entities; filters: schemaType, status, richResultProfile, eligible
GET    /crawls/:crawlId/schema/coverage   coverage + rich-result coverage by type
GET    /crawls/:crawlId/duplicates        groups; filter[field]=title|meta_description|h1|...
PATCH  /issue-states/:fingerprint         {status, assigneeId, tags} — workflow, audited
POST   /issue-states/bulk                 bulk assign/status/tag {fingerprints[], patch}
```

### Diffs, trends, dashboard

```
GET    /websites/:websiteId/dashboard     one call → all dashboard counters (from crawl_aggregates) + live crawl + next schedule
GET    /projects/:projectId/dashboard     roll-up across websites
GET    /websites/:websiteId/trends        ?metrics=seo_score,critical_issues&from&to&granularity=day|week|month
GET    /crawls/:crawlId/changes           diff vs previous; filter[changeType], filter[severity]
GET    /websites/:websiteId/compare       ?base=<crawlId>&head=<crawlId> — full comparison between any two crawls
GET    /websites/:websiteId/regressions   ?since=<crawlId|date> — everything that got worse
```

### Checks catalog & overrides

```
GET    /checks                            full catalog (id, category, severity, weight, docs)
GET    /projects/:projectId/checks        catalog merged with project overrides
PUT    /projects/:projectId/checks/:checkId   {severity?, weight?, isEnabled?}
```

### Reports & exports (async jobs)

```
POST   /projects/:projectId/reports       {type, format, params} → 202 {reportId}
GET    /reports/:reportId                 status
GET    /reports/:reportId/download        302 → signed object-storage URL
GET    /projects/:projectId/reports       history
POST   /crawls/:crawlId/export            quick export {entity: pages|issues|schema, format: csv|xlsx|json} → 202
```

### AI assistant

```
POST   /issues/explain                    {checkId, evidenceHash | issueId} → cached or generated explanation
POST   /crawls/:crawlId/prioritize        → 202; ranked fix-first list with rationale
```

### Notifications

```
GET/POST       /projects/:projectId/channels          manage channels (test ping: POST /channels/:id/test)
GET/POST       /projects/:projectId/notification-rules
PATCH/DELETE   /notification-rules/:ruleId
GET            /projects/:projectId/notifications     delivery log
```

### Audit & ops

```
GET    /projects/:projectId/audit-logs    [admin] filterable
GET    /health, /ready                    unauthenticated probes
```

## 3. Async job contract

Every long-running operation (crawl, report, export, prioritize) follows one contract:

1. `POST` returns `202 Accepted` with `{ id, status: 'queued', links: { self, cancel } }`.
2. `GET` on the resource returns `status ∈ queued|running|paused|completed|failed|cancelled` plus progress counters and, on failure, a machine-readable error.
3. `POST :id/cancel` is always available; retry semantics are explicit per resource (`retry-failed` for crawls, re-`POST` for reports with the same `Idempotency-Key` being safe).
4. Live progress where it matters (crawls) is additionally available as SSE.

## 4. Representative examples

**Start a crawl**

```http
POST /api/v1/websites/9f.../crawls
Idempotency-Key: 2c9e...
{ "mode": "incremental" }
→ 202 { "crawlId": "c71...", "status": "queued" }
```

**Issue list item**

```json
{
  "id": "…",
  "checkId": "schema.article.author.missing",
  "severity": "critical",
  "page": { "id": "…", "url": "https://www.cardekho.com/news/x" },
  "evidence": { "schemaType": "Article", "missing": ["author"], "format": "json-ld" },
  "check": { "title": "Article schema missing author", "suggestedFix": "…", "docUrl": "…" },
  "state": { "fingerprint": "…", "status": "open", "assignee": null, "tags": [] },
  "firstSeenCrawlId": "…"
}
```

**Crawl comparison response (shape)**

```json
{
  "base": { "crawlId": "…", "date": "2026-07-01", "score": 90 },
  "head": { "crawlId": "…", "date": "2026-07-02", "score": 92 },
  "summary": {
    "pagesAdded": 120,
    "pagesRemoved": 8,
    "issuesIntroduced": 34,
    "issuesResolved": 71,
    "schemaRemoved": 2,
    "canonicalChanged": 5
  },
  "changes": {
    "data": [
      {
        "changeType": "schema_modified",
        "severity": "critical",
        "page": { "url": "…" },
        "before": { "properties": ["headline", "author", "publisher"] },
        "after": { "properties": ["headline", "publisher"] },
        "detail": "author property removed"
      }
    ],
    "meta": { "nextCursor": "…" }
  }
}
```
