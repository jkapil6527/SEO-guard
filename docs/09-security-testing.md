# 09 — Security & Testing

## 1. Threat model (STRIDE-lite, top risks first)

| #   | Threat                                                                                                         | Vector                                                | Mitigation                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | **SSRF via crawler** — the product's core function is "fetch attacker-suppliable URLs from inside our network" | URL sources, sitemaps, redirects, discovered links    | Dedicated egress: resolve DNS then connect to the resolved IP (no TOCTOU re-resolution), reject private/link-local/metadata ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fd00::/8), http(s) only, re-validate **every redirect hop**, block non-standard ports by default, optional egress proxy in prod so workers have no direct internal routes |
| T2  | Stored XSS via crawled content — titles, meta, schema values are attacker-influenced and rendered in our UI    | Page artifacts displayed in dashboard                 | Never `dangerouslySetInnerHTML` for crawl data; React auto-escaping; CSP (`default-src 'self'`); HTML report generation escapes all interpolations; stored raw HTML served only as download with `Content-Disposition: attachment` + sandboxed viewer                                                                                                              |
| T3  | Broken access control across projects                                                                          | IDOR on project-scoped resources                      | Every query joins through project membership (`ProjectRoleGuard` resolves resource → project → role); no bare `findById`; integration tests assert 404 (not 403) for foreign-project ids                                                                                                                                                                           |
| T4  | Credential/session attacks                                                                                     | Login, refresh tokens                                 | argon2id hashing, login rate limiting + lockout, refresh rotation with reuse detection (revoke family), short-lived access tokens, httpOnly+SameSite=Strict cookies for web, CSRF double-submit token for cookie flows                                                                                                                                             |
| T5  | Malicious file upload                                                                                          | CSV upload                                            | Size cap, content-type + magic-byte check, stream parsing (never load to memory), formula-injection neutralization on export (`'` prefix for `=+-@` cells), files stored in object storage not on disk                                                                                                                                                             |
| T6  | Secrets exposure                                                                                               | Site auth headers for staging crawls, webhook secrets | Encrypted at rest (pgcrypto/KMS), write-only API (never echoed back), redacted in logs/audit                                                                                                                                                                                                                                                                       |
| T7  | Webhook abuse                                                                                                  | Outbound notifications                                | HMAC-signed payloads, per-channel secret, retries with backoff, destination allowlist option                                                                                                                                                                                                                                                                       |
| T8  | Job queue poisoning / payload tampering                                                                        | Redis compromise                                      | Redis AUTH + network isolation; job payloads carry ids not data (workers re-read from PG); no eval of payload content                                                                                                                                                                                                                                              |
| T9  | DoS of our own properties                                                                                      | Misconfigured crawl                                   | Politeness limits enforced server-side with hard caps regardless of settings; circuit breaker per domain; robots.txt honored by default                                                                                                                                                                                                                            |
| T10 | Audit/repudiation gaps                                                                                         | Disputed changes                                      | Append-only `audit_logs` for every mutation with before/after, actor, IP                                                                                                                                                                                                                                                                                           |

Cross-cutting: zod validation on every input boundary (API pipes, job payloads, env config); dependency scanning + lockfile audit in CI; least-privilege DB roles (api = r/w app schema, workers = r/w, readonly role for replica dashboards); rate limiting per user and per IP; security headers (HSTS, X-Content-Type-Options, frame-ancestors none).

## 2. Testing strategy

| Layer                                 | What                                                                                                                              | How                                                                                                            | Gate                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Engine unit tests** (largest suite) | Every SEO check: pass/fail/edge fixtures; every schema extractor & validator; scoring                                             | HTML/JSON fixtures in-repo; pure functions, no mocks needed; property-based tests for URL normalizer & simhash | ≥ 80% line, 100% of checks have ≥ 3 fixtures |
| **Rule-pack tests**                   | Vocab + profile packs stay sane across regeneration                                                                               | Golden tests: known entities → expected verdicts; pack diff report on regeneration                             | CI                                           |
| **Crawler tests**                     | Fetch semantics: conditional GET, redirects, encodings, robots, sitemaps (index/gzip/broken), SSRF guard                          | Local fixture HTTP server (misbehaving endpoints: loops, 30-redirect chains, private-IP redirects, slowloris)  | CI                                           |
| **API integration**                   | Every endpoint: authz matrix (each role × each route), validation errors, pagination contracts, idempotency                       | NestJS testing module + testcontainers (real PG + Redis); seeded multi-project dataset                         | CI                                           |
| **Worker integration**                | Full pipeline on docker-compose: seed site → crawl → assert snapshots/issues/aggregates/diff                                      | Fixture website served in the compose network; deterministic assertions on counts & scores                     | CI                                           |
| **E2E**                               | Golden paths: login → create project → add sitemap → run crawl → dashboard shows results → assign issue → compare crawls → export | Playwright against compose stack                                                                               | CI (nightly full, PR smoke)                  |
| **Regression suite**                  | Re-run engines over a frozen corpus of ~200 real-world stored pages; diff issue output vs golden                                  | Any check change shows exactly its intended output delta                                                       | CI, human-reviewed diff                      |
| **Load tests**                        | 100k-page synthetic crawl; dashboard queries during crawl; queue drain rates                                                      | k6 + fixture generator; run pre-release and on pipeline changes                                                | NFR-SCALE thresholds                         |
| **Security tests**                    | SSRF payload corpus, authz fuzz (role × resource), upload abuse                                                                   | Part of API/crawler suites + periodic ZAP baseline scan                                                        | CI                                           |

**Conventions:** tests colocated (`*.spec.ts` unit, `*.int.spec.ts` integration, `apps/*/e2e/`); factories over fixtures for DB entities; no test hits the real network (fixture server only); flaky tests quarantined within 24h or deleted; every bug fix lands with a failing-first test.

**CI pipeline:** lint + dependency-boundary check → typecheck → unit → integration (testcontainers) → build → E2E smoke → (nightly) full E2E + regression corpus + pack-diff report.

## Egress proxy (crawler SSRF hardening) — Phase 3/4 note

The `SafeFetcher` in `packages/crawler-core` fully guards the static fetch path:
it resolves DNS once, pins the vetted IP, rejects private/loopback/link-local/
metadata ranges, and re-checks every redirect hop. **The Playwright render path
is different**: once a page is handed to Chromium, the browser performs its own
navigation and sub-resource requests, and a client-side (JS) redirect can reach
a host the in-process guard never sees. The render path today mitigates this by
only rendering the Safe-Fetcher-validated final URL and blocking image/font/media
sub-resources, but that is not a complete boundary.

**Design: a forward egress proxy.** In production, workers should have **no direct
route to internal network space**. All crawl egress — both `SafeFetcher` and the
Playwright pool — is routed through a dedicated forward proxy that enforces a
single allow/deny policy (block RFC1918/loopback/link-local/metadata, optional
per-project domain allowlists, request logging). This turns SSRF prevention into
a network-layer guarantee rather than an application-layer best effort.

Extension points already in place:

- `EGRESS_PROXY_URL` (worker env). When set, `BrowserPoolService` launches Chromium
  with `proxy.server = EGRESS_PROXY_URL`, so all browser traffic transits the proxy.
- `SafeFetcher` accepts a `SafeFetcherOptions` object; adding an `httpProxy` field
  that issues `CONNECT` tunnels through the same proxy is the remaining work to put
  the static path behind the identical boundary. The application guard stays on as
  defense-in-depth.

Deployment guidance: run the proxy as a separate hardened service (e.g. a policy
proxy on the worker subnet), give the worker pods an egress network policy that
only permits traffic to the proxy, and keep `EGRESS_PROXY_URL` pointed at it. With
that in place the render path inherits the same SSRF protections as the static path.
