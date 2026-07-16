# 01 — Requirements

## 1. Functional Requirements

Requirements are numbered `FR-<area>-<n>` for traceability from design docs, code, and tests.

### FR-PRJ — Projects & websites

- **FR-PRJ-1** Users can create unlimited projects (e.g. CarDekho, BikeDekho, ZigWheels, TyreDekho, internal sites).
- **FR-PRJ-2** Each project contains one or more websites (domain + protocol + optional path scope).
- **FR-PRJ-3** Each project has its own dashboard, crawl history, schedules, reports, team members, and settings.
- **FR-PRJ-4** Project settings include: render policy (HTTP-only / render-JS / auto), crawl politeness limits, check severity/weight overrides, duplicate-detection thresholds, retention overrides, notification rules.
- **FR-PRJ-5** Users belong to projects with a role (see §3); all data access is scoped by project membership.

### FR-INP — URL inputs

- **FR-INP-1** Accept a single URL, a pasted list of URLs, and CSV upload (column mapping UI, up to 1M rows).
- **FR-INP-2** Accept one or many XML sitemaps per website, including sitemap index files and gzipped sitemaps; recurse nested indexes.
- **FR-INP-3** Support domain-level crawling: start from seed URLs, discover internal links up to configurable depth/page-count limits, respecting robots.txt.
- **FR-INP-4** URL sources are persistent per website; each crawl resolves the current URL set from all active sources.
- **FR-INP-5** Normalize and deduplicate URLs (scheme/host casing, default ports, fragment stripping, configurable query/trailing-slash policy).

### FR-CRL — Crawling & scheduling

- **FR-CRL-1** Manual on-demand crawls per website (full or subset of URLs).
- **FR-CRL-2** Scheduled crawls: daily, every 6 hours, weekly, monthly, and custom cron expressions (with timezone).
- **FR-CRL-3** Every crawl creates a new immutable snapshot; previous crawl data is never overwritten and is stored permanently (subject to explicit retention policy, §2 NFR-RET).
- **FR-CRL-4** Incremental crawling: use sitemap `lastmod`, HTTP conditional requests (ETag / Last-Modified), and content hashes to detect unchanged pages; optionally carry forward prior results for unchanged pages to save fetch/validation cost.
- **FR-CRL-5** Detect newly discovered pages, deleted pages (in previous crawl / sitemap but now absent or 404/410), redirected pages, and new sitemap entries.
- **FR-CRL-6** Crawl controls: pause, resume, cancel, retry failed pages, priority; live progress (crawled / pending / failed counts).
- **FR-CRL-7** Respect robots.txt (configurable override for owned properties), per-domain concurrency and request-rate limits, custom User-Agent, optional auth headers/cookies for staging environments.
- **FR-CRL-8** Fetch strategy: plain HTTP + Cheerio by default; Playwright rendering when the website's render policy requires it or auto-detection finds client-rendered content.

### FR-VAL — Technical SEO validation

- **FR-VAL-1** Validate every crawled page against the check catalog (full catalog in [06-validation-engines.md](06-validation-engines.md)) covering: meta (title, description, canonical, robots, charset, viewport, lang, theme-color, alternate/hreflang, Open Graph, Twitter Card, favicon, manifest), headings (missing/multiple/empty/duplicate H1, hierarchy, skipped levels), images (alt, dimensions, lazy loading, broken, MIME), links (internal/external, broken, redirect chains, rel attributes, anchor quality, orphan pages), and technical (HTTPS, status codes, redirects, robots.txt, sitemap membership, hreflang reciprocity, pagination, noindex/nofollow, canonical mismatch/duplicates, blocked resources, URL structure, trailing-slash consistency).
- **FR-VAL-2** Every issue carries: check id, severity (Critical/High/Medium/Low/Info), description, business impact, SEO impact, technical explanation, suggested fix, priority, reference documentation link, and page evidence (extracted values, DOM location).
- **FR-VAL-3** Severity and score weight per check are overridable per project; checks can be disabled per project.

### FR-SCH — Schema.org validation

- **FR-SCH-1** Detect all structured data on a page in JSON-LD, Microdata, and RDFa; parse into a normalized entity graph.
- **FR-SCH-2** Validate every entity against the versioned schema.org vocabulary: unknown types, unknown/deprecated properties, expected value types, nested objects, and relationships.
- **FR-SCH-3** Validate against Google rich-result profiles (Article, Product, Review, Breadcrumb, FAQ, Event, Video, JobPosting, Vehicle, and all other supported profiles): required vs recommended properties, and eligibility verdicts with explicit pass/fail reasons.
- **FR-SCH-4** Per entity, report: type, validation status, detected/required/recommended/missing/invalid/deprecated properties, nesting, rich-result eligibility, JSON syntax errors, warnings, errors, confidence score.
- **FR-SCH-5** Compare schema between crawls: entity added/removed, property added/removed/changed — with severity (e.g. removed `author` on Article = Critical).
- **FR-SCH-6** Report schema coverage (% of pages with valid structured data) and rich-result coverage per website.

### FR-DUP — Duplicate detection

- **FR-DUP-1** Detect exact duplicates across a crawl for: title, meta description, H1, canonical target, Open Graph, Twitter Card, and schema payloads.
- **FR-DUP-2** Detect near-duplicate body content via similarity hashing with a per-project configurable threshold.

### FR-DIF — Change detection & history

- **FR-DIF-1** Maintain complete crawl history per website (date, score, issue counts) and allow comparison between any two crawls.
- **FR-DIF-2** Between consecutive crawls, automatically compute: new/removed pages; changed titles, meta descriptions, canonicals, robots directives; schema added/removed/modified; broken links introduced/fixed; issues introduced/resolved.
- **FR-DIF-3** Regression report: everything that got worse since a chosen baseline crawl.

### FR-DSH — Dashboard & analytics

- **FR-DSH-1** Project and website dashboards showing: overall SEO score, health status, pages crawled/pending/failed, critical issues, warnings, passed checks, total checks, schema coverage, rich-result coverage, broken pages, noindex pages, duplicate pages, canonical/meta/image/heading/internal-link/external-link error counts, daily crawl status, live crawl progress, next scheduled crawl.
- **FR-DSH-2** Trend charts (daily/weekly/monthly): SEO score, issue counts by severity, resolved issues, schema coverage, duplicate metadata, canonical errors, broken links, pages crawled, daily changes.
- **FR-DSH-3** Page explorer: search and filter by project, website, directory/path prefix, URL, issue type, severity, schema type, validation status, date, crawl, assignee, status, tag.
- **FR-DSH-4** Issue workflow: assign issues to team members, set status (open / acknowledged / in-progress / fixed / ignored), tag issues; "ignored" suppresses recurrence in future crawls but is auditable.

### FR-AI — AI assistant

- **FR-AI-1** For any issue, generate on demand: human explanation, developer explanation, SEO impact, business impact, recommended fix with implementation example, priority recommendation, estimated effort.
- **FR-AI-2** AI never fabricates crawl data: prompts contain only engine-produced facts; outputs are cached by (check id, evidence hash) and labeled as AI-generated.
- **FR-AI-3** AI prioritization: given a crawl's issue set, produce a ranked "fix first" list with rationale.

### FR-RPT — Reports & exports

- **FR-RPT-1** Report types: Executive, SEO Team, Developer, Schema, Daily, Weekly, Monthly, Historical Comparison, Regression, Trend.
- **FR-RPT-2** Export formats: PDF, Excel (xlsx), CSV, JSON, HTML. Report generation is an async job with progress and a download link.
- **FR-RPT-3** Scheduled report delivery via notification channels.

### FR-NTF — Notifications

- **FR-NTF-1** Alert rules per project: SEO score drop (threshold), schema failure, canonical missing, noindex detected, broken sitemap, robots.txt changed, broken-link spike, crawl completed, crawl failed.
- **FR-NTF-2** Channels: Email, Slack, Microsoft Teams, generic webhook (HMAC-signed payload).
- **FR-NTF-3** Deduplication and throttling so a bad deploy doesn't send thousands of messages.

### FR-USR — Users, roles, audit

- **FR-USR-1** Roles: Super Admin, Admin, SEO Manager, Developer, Viewer (matrix in §3).
- **FR-USR-2** JWT auth (access + refresh), password policy, session revocation.
- **FR-USR-3** Audit log of every mutating action (who, what, when, before/after where practical).

### FR-API — API platform

- **FR-API-1** Versioned REST API (`/api/v1`) with authentication, pagination, sorting, filtering, search, bulk operations, async job submission, status tracking, retry, cancellation. Full spec in [04-api.md](04-api.md).

## 2. Non-Functional Requirements

| ID          | Requirement                                                                                                                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-SCALE-1 | Support ≥ 5M monitored pages across all projects; a single website up to 2M pages.                                                                                                                                                                                                  |
| NFR-SCALE-2 | Sustain ≥ 200 pages/sec aggregate fetch+validate throughput with horizontally scaled workers; a 1M-page site completes a daily crawl in < 8h at polite per-domain rates.                                                                                                            |
| NFR-SCALE-3 | Crawl workload never degrades API/dashboard latency (separate worker processes and DB connection pools; heavy aggregates precomputed).                                                                                                                                              |
| NFR-PERF-1  | Dashboard API p95 < 500 ms on precomputed aggregates; page-explorer queries p95 < 2 s over 2M-page crawls (partitioning + indexes).                                                                                                                                                 |
| NFR-PERF-2  | Validation engine: ≥ 50 pages/sec/worker-core for HTTP-fetched pages (excluding network time).                                                                                                                                                                                      |
| NFR-REL-1   | Job-level at-least-once processing with idempotent persistence; a crashed worker's jobs are retried automatically; a crawl survives worker restarts and resumes.                                                                                                                    |
| NFR-REL-2   | Failure isolation: one misbehaving website (slow, blocking, erroring) cannot stall other projects' crawls.                                                                                                                                                                          |
| NFR-REL-3   | Target 99.5% availability for the dashboard/API during business hours.                                                                                                                                                                                                              |
| NFR-RET-1   | Crawl summaries and trend aggregates retained forever. Page snapshots retained ≥ 13 months by default (configurable per project). Raw HTML bodies retained 30 days (configurable), then dropped — extracted artifacts remain.                                                       |
| NFR-SEC-1   | JWT auth, RBAC on every endpoint, rate limiting, strict input validation, CSRF protection for cookie-based flows, secrets via environment/secret manager, SSRF-hardened fetcher, secure CSV/file upload handling. Threat model in [09-security-testing.md](09-security-testing.md). |
| NFR-MNT-1   | Clean Architecture + SOLID: framework-free domain packages, dependency direction enforced by lint rules; adding a new SEO check or schema type requires no changes outside the engine packages/rule packs.                                                                          |
| NFR-TST-1   | Unit, integration, E2E, crawler, schema-validation, API, and regression test suites; ≥ 80% coverage on engine packages; CI-gated.                                                                                                                                                   |
| NFR-OBS-1   | Structured logs with correlation ids (crawlId/pageId/jobId), Prometheus metrics (queue depth, fetch latency, error rates, pages/sec), health endpoints, dead-letter queue visibility.                                                                                               |
| NFR-I18N-1  | Handle non-UTF-8 pages, IDN domains, and hreflang/multilingual sites correctly.                                                                                                                                                                                                     |
| NFR-UX-1    | Responsive UI, dark mode, keyboard-accessible tables and forms.                                                                                                                                                                                                                     |

## 3. Roles & permission matrix

| Capability                                       | Super Admin | Admin | SEO Manager | Developer | Viewer |
| ------------------------------------------------ | ----------- | ----- | ----------- | --------- | ------ |
| Manage users & global settings                   | ✅          | —     | —           | —         | —      |
| Create/delete projects                           | ✅          | ✅    | —           | —         | —      |
| Manage project settings, members, schedules      | ✅          | ✅    | ✅          | —         | —      |
| Start/pause/cancel crawls                        | ✅          | ✅    | ✅          | —         | —      |
| Configure checks, severities, notification rules | ✅          | ✅    | ✅          | —         | —      |
| Assign issues, change issue status, tag          | ✅          | ✅    | ✅          | ✅        | —      |
| View dashboards, pages, issues, schema results   | ✅          | ✅    | ✅          | ✅        | ✅     |
| Generate/download reports & exports              | ✅          | ✅    | ✅          | ✅        | ✅     |
| View audit logs                                  | ✅          | ✅    | —           | —         | —      |

Super Admin is global; all other roles are **per-project memberships** (a user can be Admin on CarDekho and Viewer on BikeDekho).
