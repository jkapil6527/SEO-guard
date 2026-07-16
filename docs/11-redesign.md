# 11 — Project-Centric Redesign

**Status:** Proposal — awaiting approval · **Author:** Platform · **Date:** 2026-07-14

This document proposes a redesign of the UI and a restructuring of the supporting
architecture, to move the platform from a *website-centric* tool to a
**project-centric, category-driven workflow**.

It is a **redesign of the existing system**, not a rewrite. The crawler, the queue
topology, the SEO engine, the schema engine and the persistence model are sound and
are retained. What changes is the information architecture, the URL-analysis surface,
and the introduction of one genuinely new domain concept: the **sitemap group**.

> **Two decisions taken before writing this document** (confirmed with the requester):
>
> 1. **Performance / Accessibility / Best-Practices auditing is phased, not dropped.**
>    `00-overview.md` currently lists Lighthouse, Core Web Vitals, performance scoring and
>    accessibility auditing as **explicit non-goals**. The new requirements reverse that.
>    We honour the reversal, but stage it: Phases 1–3 ship the SEO-correctness product on
>    data the engine already produces; Phase 4 adds the audit pipeline. `00-overview.md`
>    must be amended when Phase 4 is approved.
> 2. **Sitemap groups become a first-class table**, not an overload of `url_sources`.

---

## 1. Existing architecture review

### 1.1 What is genuinely good — and is kept

| Strength | Evidence |
| --- | --- |
| **Pure, I/O-free engines.** `seo-engine` and `schema-engine` are deterministic functions of fetched artifacts. Checks are data-driven with metadata (severity, weight, remediation copy). | `packages/seo-engine/src/checks.ts:13`, `catalog.ts:133` |
| **Immutable snapshots.** A crawl never overwrites. History, diffs and trends are derivable. | `page_snapshots` (`initial-schema.sql:128`) |
| **Correct partitioning.** `page_snapshots`, `page_issues`, `schema_entities`, `crawl_changes` are monthly RANGE-partitioned with automated maintenance. | `initial-schema.sql:344`, `partition.service.ts` |
| **Real rendering.** Playwright Chromium with a pooled browser, context-per-job, recycled every 50 pages, with an `auto` heuristic. Not a stub. | `browser-pool.service.ts:51` |
| **Politeness is centralised.** Per-domain rate/concurrency in the queue layer. | `crawl-config.ts` |
| **Sitemap index support already exists.** Nested sitemaps recurse, cycle-safe, gzip-aware, and `lastmod` **is already parsed**. | `crawler-core/src/sitemap.ts:152`, `:175` |
| **Rich, unused data.** 46 schema.org types, 12 rich-result profiles, 42 SEO checks, full per-page artifacts. | `schema-engine/src/packs/` |

The single most important finding of this review: **the backend already captures far more
than the UI shows.** Most of the requested URL Report page is a *rendering* problem, not a
data problem. See §1.4.

### 1.2 Structural problems in the backend

| # | Problem | Location | Impact on the new design |
| --- | --- | --- | --- |
| B1 | **Crawls are website-scoped only.** There is no `url_source_id` on `crawls`; the resolver merges *every* active source into one crawl and loses provenance. | `crawls` table; `url-resolver.service.ts:51` | **Blocks per-category crawling outright.** |
| B2 | **One-active-crawl-per-website guard.** A 409 is thrown if any crawl is active for the website. | `crawls.service.ts:69` | Six categories would **serialise**. Must become group-aware. |
| B3 | **`findPreviousCompleted` is per-website.** | `crawls.repository.ts:69` | An incremental *Model Pages* crawl would baseline against the last *Compare Pages* crawl. Cross-contamination. |
| B4 | **`trend_daily` PK is `(website_id, day)`.** One row per website per day. | `initial-schema.sql:256` | Per-category health trends are **impossible** without a key change. |
| B5 | **`url_sources` has no name/label.** | `initial-schema.sql:68` | Categories have no human identity. |
| B6 | **Sitemap `lastmod` is parsed then discarded.** | `url-resolver.service.ts:96` | Free incremental-crawl win, thrown away. |
| B7 | **Hardcoded caps: 10 000 URLs, 50 nested sitemaps.** | `crawl-config.ts:50`, `sitemap.ts:15` | A real BikeDekho sitemap index will hit both. |
| B8 | **No aggregate endpoint.** No "latest crawl summary for X". | — | Dashboard cards would need N+1 client fetches. |
| B9 | **Broken links are never exposed.** `link_checks` is written, read only by the finalizer. | `link-check.processor.ts` | The "Broken Links" column and section have no API. |
| B10 | **`duplicate_groups` is written but never read** by any API or UI. | `page-issues.repository.ts:79` | Free win, currently invisible. |
| B11 | **`website.path_scope` is never enforced** — the crawler hardcodes `'/'`. | `page-processor.service.ts:145`, `:317` | Latent bug. |

### 1.3 Correctness bugs found during the audit

These are **pre-existing defects**, independent of the redesign. They should be fixed in
Phase 0 because the new report page would otherwise display wrong numbers prominently.

| # | Bug | Detail |
| --- | --- | --- |
| **C1** | **Page scores are stale.** `snapshot.score` is computed in `page-processor.service.ts:146`, *before* finalize inserts duplicate issues and broken-link issues. It is never recomputed. | Every per-page score **excludes** duplicate and broken-link deductions, and the site `seoScore` is the mean of those stale values. `criticalPages` reads the equally stale `issue_counts`, so a page whose only critical issue is a broken internal link never triggers the 79-point cap. |
| **C2** | **Two checks never fire.** `runChecks()` is called without `linkStatuses`, so `links.redirect.chain_too_long` and `images.src.broken` short-circuit to `not_applicable` and are dropped. | `page-processor.service.ts:145`. `redirect_hops` is populated in `link_checks` but has **no consumer**. |
| **C3** | **Image `src` URLs are never link-checked.** `enqueueLinkTargets` sends `artifacts.links` only — not `artifacts.images`. | `page-processor.service.ts:290`. Broken images are undetectable today. |
| **C4** | **`renderPolicy: 'never'` silently disables link discovery.** Discovery expansion is gated on `renderPolicy !== 'never'`. | `page-processor.service.ts:189`. Two unrelated concerns coupled. |
| **C5** | **`crawl_changes` is schema-only.** There is no SEO change detection — no title/description/H1/canonical/status/score deltas between crawls. | `finalize.processor.ts:130`. The "Compare current vs previous crawl" requirement needs this built; the table is generic enough to reuse. |

### 1.4 Requirements coverage — what the engine can already answer

This is the central planning table. It maps the 14 requested report sections onto data
that **exists today**.

| § | Report section | Status | Source |
| --- | --- | --- | --- |
| 1 | Overview (URL, status, title, crawl date) | ✅ **Exists** | `artifacts`, `page_snapshots` |
| 1 | Health / SEO score | ✅ Exists (after C1 fix) | `page_snapshots.score` |
| 1 | Perf / Accessibility / Best-Practices score | ❌ **Does not exist** | — → **Phase 4** |
| 1 | TTFB, Load, Render time, Content/HTML size | ❌ Does not exist (`timing_ms` holds only `{fetch: totalMs}`) | → **Phase 4** |
| 2 | Heading structure (H1–H6, counts, hierarchy) | ✅ **Fully exists** | `artifacts.headings[]` + 5 checks |
| 3 | Meta tags (title, desc, robots, canonical, lang, charset, viewport, OG, Twitter) | ✅ **Fully exists** | `artifacts` + 19 checks |
| 3 | Structured-data counts (JSON-LD / Microdata / RDFa) | ✅ Exists | `schema_entities.format` |
| 4 | Content: word count, internal/external links, anchors | ✅ Exists | `artifacts.wordCount`, `artifacts.links[]` |
| 4 | Keywords, density, reading time, thin/duplicate content % | ⚠️ **Partial** — body text is **not stored** (only `wordCount`); exact-hash duplicates exist, near-duplicate does not | → Phase 3 (store extracted text) |
| 5 | Images: URL, alt, missing alt, lazy, dimensions | ✅ Exists | `artifacts.images[]` |
| 5 | Image file size, WebP/AVIF, responsive, broken | ❌ Does not exist (only raw `width`/`height` **attribute strings**) | → Phase 4 |
| 6 | Links: internal/external/nofollow/anchor text/HTTP status | ✅ **Exists** | `artifacts.links[]` + `link_checks` |
| 6 | Broken links, redirect links | ✅ Data exists, **no API** (B9) | → Phase 2 |
| 7 | Technical SEO: canonical, indexable, noindex, hreflang, HTTPS, mixed content, redirect chains | ✅ **Fully exists** | `artifacts` + 6 technical checks |
| 8 | Structured data: detection, validation, rich results | ✅ **Fully exists** — 46 types, 12 profiles | `schema-engine` |
| 9 | HTML validation | ❌ Does not exist | → Phase 4 |
| 10 | Accessibility | ❌ Does not exist | → Phase 4 |
| 11 | Performance | ❌ Does not exist | → Phase 4 |
| 12 | Best-practices checklist | ⚠️ Partial — the SEO half exists; HTTPS/compression/caching/minification do not | → Phase 4 |
| 13 | Recommendations (problem, reason, impact, fix, reference) | ✅ **Exists as data!** Every check carries `title`, `description`, `seoImpact`, `businessImpact`, `suggestedFix`, `docUrl`, `weight` | `checks` table — needs only prioritised rendering |
| 14 | Export: JSON, CSV | ✅ Exists | `lib/export.ts` |
| 14 | PDF, Excel, HTML report | ❌ `exportPdf` is a `window.print()` stub with no print stylesheet | → Phase 3 |

**Conclusion: ~70 % of the requested report is renderable from data that already exists.**
That is what makes an aggressive Phase 1–3 realistic.

---

## 2. UI problems

Grounded in an audit of all 60 files / ~5 185 LOC in `apps/web/src`.

### P1 — There is no design system, only repeated utility strings
There is **no `tailwind.config`, no `@theme` block, no CSS variables**. `globals.css` is 21
lines. Every colour is a literal Tailwind utility written **twice** (`text-slate-500
dark:text-slate-400` appears ~40 times). "Primary" is the string `bg-blue-600` typed out in
at least five files. **The application cannot be re-themed** — a brand change is a
find-and-replace across 30 files. This is the highest-leverage fix in the codebase.

### P2 — There are no primitive components
There is **no `<Button>`, no `<Input>`, no `<Select>`, no `<Checkbox>`, no `<Toast>`, no
`<Tooltip>`, no `<Dropdown>`, no `<Skeleton>`** anywhere in the app. `form.tsx` exports
*class-name strings*, so variants are produced by **string concatenation**:
`` className={`${primaryButtonClasses} rounded-r-none`} ``. There is no destructive button
style, so it is re-invented inline twice; there is no size scale — every button is
`px-4 py-2`.

### P3 — `DataTable` cannot do what the new URL list page requires

| Capability | Supported |
| --- | --- |
| Sorting | ❌ (no `aria-sort`, no sort state) |
| Pagination | ❌ |
| Row selection / bulk actions | ❌ |
| Virtualization | ❌ |
| Sticky header | ❌ |
| Column show/hide | ❌ |
| Keyboard-operable rows | ❌ — `onClick` on `<tr>`, not a link: no focus, no Enter/Space, no cmd-click |

The requested URL list needs **sort + filter + paginate + bulk-select** — it supports
**none of the four**. It is a presentational `<table>` renderer and must be replaced.

### P4 — The data layer silently truncates every list at 100 rows
**Every list hook hardcodes `limit: '100'`** and no hook reads `meta.nextCursor`. There is
no `useInfiniteQuery`, no cursor, no offset. A 1 240-URL sitemap will display **100 rows**
and give no indication that 1 140 are missing. The `Paginated<T>` envelope is defined and
ignored.

### P5 — Zero URL state
`grep useSearchParams` → **zero hits**. Every filter, sort and tab lives in local
`useState`. Nothing is shareable, bookmarkable, or survives a back-navigation. This
directly blocks the requested filter/sort/pagination workflow.

### P6 — Filters are implemented three incompatible ways
A toggle-chip multi-select (issues), a single-select chip row (pages), and native
`<select>`/`<input>` (schema, reports). The chip's 6-line active/inactive Tailwind ternary
is **copy-pasted verbatim across three pages**. None carries `aria-pressed`. The schema
text filter **fires a query on every keystroke** — no debounce.

### P7 — Charts are a hand-rolled SVG toy
No axes, no gridlines, no ticks, no tooltips, no hover, no legend, no responsive resize, no
multi-series. `LineChart` uses `preserveAspectRatio="none"`, which **distorts the stroke and
turns point circles into ellipses**. The `x` value of each point is accepted and then
**ignored** (mapped by index) — a non-uniform time axis is impossible. Colours are hex
constants, so **the charts do not respond to dark mode**. `role="img"` with no label ⇒
**invisible to screen readers**.

### P8 — 4 loading × 4 error × 4 empty patterns; no toasts
Four different loading treatments (spinner, one skeleton, bespoke block, inline text), four
error cards (only one with a retry button), four empty states (one containing a raw emoji).
There are **no toasts anywhere** — `start-crawl-button.tsx:38` literally contains
`// error toast could go here` above an empty `catch`. Mutation errors are silently
swallowed in several places.

### P9 — Accessibility is below baseline
No skip-link. **No focus trap in `Modal`** (Tab walks out behind the dialog). No
`aria-pressed` on any filter. Table rows are **mouse-only**. `ProgressBar` has no
`role="progressbar"`/`aria-valuenow`, and the live crawl counter is **not in an `aria-live`
region** — grep confirms **zero** `aria-live`, `aria-busy`, `aria-sort` in the entire
`src/`. Charts are unlabelled. Delete uses `window.confirm()`.

### P10 — Navigation does not reflect the domain
The sidebar has exactly **two** links (Projects, Reports). `projectNav` is a
`const projectNav: NavItem[] = []` followed by 12 lines of dead conditional rendering.
Breadcrumbs handle only `/admin`, `/reports` and `/projects/[slug]` — **`/websites/*` and
`/crawls/*`, i.e. most of the app, fall through to a bare "Projects" crumb**, and the code
references `/admin` and `trends` routes that do not exist. There is no way to navigate from
a crawl back to its website.

### P11 — Visible dead scaffolding
`AuthGuard` (pure passthrough), `AuthProvider` (fake `SYSTEM_USER`), `RoleChip` (always
renders "Super admin" because memberships are always `[]`), `UserMenu` (an avatar, not a
menu), plus 4 unused components (`StatCard`, `PlaceholderPage`, `FullPageLoader`,
`Sparkline`), 7 unused icons, an unused `exportPdf` stub, and an unused `useSchemaHistory`
hook. Helper functions are duplicated 2–3× (`fmt()` three times, `messageOf()` twice,
`SEVERITY_ORDER` twice, the Export CSV/JSON button pair three times).

### P12 — Content is capped at 1152 px
`max-w-6xl` on the main element applies to **every page**, including data tables that need
full width. There is no `md:` breakpoint tier at all (jumps `sm` → `lg`), and tables merely
scroll sideways on mobile with no card-stack fallback.

---

## 3. UX improvements

### U1 — Project-centric navigation (the core ask)
Replace the flat *website → crawl* model with:

```
Dashboard → Projects → Project → Category (sitemap group) → Crawl → URL list → URL report
```

The sidebar becomes **contextual**: at the workspace level it shows Projects / Reports /
Settings; once inside a project it shows that project's categories, with live status dots.

### U2 — The category card is the primary object
Each sitemap group renders as a card carrying exactly the requested facts — Total URLs,
Last Crawl, Crawl Status, Health Score, Broken URLs, Errors, Warnings — plus a 30-day
sparkline and a one-click **Crawl Sitemap** action. Every number on the card is a
**drill-down link into a pre-filtered URL list**, never a dead statistic.

### U3 — Crawling becomes a first-class, observable activity
A persistent **crawl progress dock** (bottom-right, dismissible) shows live SSE progress for
any running crawl, from anywhere in the app, with the requested breakdown:

```
Collected 1240/1240 · Analyzed 500/1240 · Remaining 740 · ETA 2m 30s
```

Today this is only visible if you are sitting on the crawl detail page.

### U4 — Every filter, sort and page lives in the URL
`?q=&status=&score=&sort=&dir=&page=` — via a single `useTableState` hook bound to
`useSearchParams`. Views become shareable ("here are the 43 noindexed model pages") and
back-button-safe.

### U5 — Progressive disclosure on the URL report
14 sections is far too much for one scroll. The report becomes a **sticky summary header**
(URL, scores, status — always visible) plus **tabbed sections** with an in-page
scroll-spy rail. Each section is an independently-loading, independently-erroring
component (§5).

### U6 — Recommendations become the landing tab
The `checks` table **already stores** `seoImpact`, `businessImpact`, `suggestedFix`,
`docUrl` and `weight` for all 47 checks. Sorting a page's issues by
`weight × severityMultiplier` yields a genuine prioritised fix-list — Problem, Reason,
Impact, Fix, Reference — with **zero new backend work**. This is the highest-value,
lowest-cost feature in the entire proposal.

### U7 — Honest empty and loading states
Skeletons that match final layout (not spinners). Empty states that name the next action.
Toasts for every mutation. No silently swallowed errors.

---

## 4. Folder restructuring

The requested layout is adopted, mapped onto the existing Next.js App Router conventions.
The current `features/` slices are **kept and renamed to `modules/`** — the pattern is
already correct, only the vocabulary changes.

```
apps/web/src/
├── app/                          # routing only — thin, no business logic
│   ├── (dash)/
│   │   ├── page.tsx                                  → Dashboard
│   │   ├── projects/page.tsx                         → Projects list
│   │   ├── projects/[slug]/
│   │   │   ├── page.tsx                              → Project dashboard (category cards)
│   │   │   ├── categories/[groupId]/
│   │   │   │   ├── page.tsx                          → Category overview + crawl history
│   │   │   │   └── urls/page.tsx                     → URL list (the big table)
│   │   │   ├── settings/page.tsx
│   │   │   └── compare/page.tsx                      → Crawl-vs-crawl comparison
│   │   ├── urls/[snapshotId]/page.tsx                → URL REPORT (14 sections)
│   │   ├── compare/page.tsx                          → URL-vs-URL comparison
│   │   └── reports/page.tsx
│   └── layout.tsx
│
├── modules/                      # vertical slices: api + hooks + feature components
│   ├── projects/
│   ├── categories/               # NEW — sitemap groups
│   ├── crawler/                  # start/pause/cancel, progress dock, SSE
│   ├── urls/                     # URL list table, filters, bulk actions
│   ├── reports/                  # the 14 report sections
│   │   └── sections/             # one independent component per section
│   │       ├── overview-section.tsx
│   │       ├── headings-section.tsx
│   │       ├── meta-section.tsx
│   │       ├── content-section.tsx
│   │       ├── images-section.tsx
│   │       ├── links-section.tsx
│   │       ├── technical-section.tsx
│   │       ├── schema-section.tsx
│   │       ├── html-validation-section.tsx     # Phase 4
│   │       ├── accessibility-section.tsx       # Phase 4
│   │       ├── performance-section.tsx         # Phase 4
│   │       ├── best-practices-section.tsx      # Phase 4
│   │       ├── recommendations-section.tsx
│   │       └── export-section.tsx
│   ├── seo/                      # shared SEO presentation (score, severity, checks)
│   ├── schema/
│   └── export/
│
├── components/
│   ├── primitives/               # NEW — Button, Input, Select, Checkbox, Badge,
│   │                             #       Tooltip, Dropdown, Toast, Skeleton, Dialog
│   ├── data/                     # DataTable (TanStack), FilterBar, Pagination, BulkBar
│   ├── charts/                   # Recharts wrappers, theme-aware
│   └── feedback/                 # EmptyState, ErrorState, QueryBoundary, ProgressDock
│
├── layouts/                      # AppShell, SidebarNav, TopBar, ReportLayout
├── hooks/                        # useTableState, useDebounce, useCrawlProgress, useTheme
├── services/                     # api client, sse client, query-key registry
├── styles/                       # tokens.css (@theme), globals.css
└── utils/                        # format, url, score, date  ← kills the 3× duplicated fmt()
```

**Backend** keeps its existing NestJS module structure. One new module (`sitemap-groups`),
one new worker processor (Phase 4: `audit.processor`).

---

## 5. Component hierarchy

```
AppShell
├── SidebarNav
│   ├── WorkspaceSection      → Dashboard · Projects · Reports
│   ├── ProjectSection        → contextual: category list w/ live status dots
│   └── ProjectSwitcher
├── TopBar                    → Breadcrumbs · GlobalSearch · ThemeToggle
├── CrawlProgressDock         → SSE-driven, global, dismissible
└── <page>

ProjectDashboard
└── CategoryGrid
    └── CategoryCard × N              ← the primary object
        ├── HealthGauge
        ├── StatRow (Total URLs · Broken · Errors · Warnings)
        ├── Sparkline (30-day score)
        ├── CrawlStatusChip
        └── CrawlSitemapButton → CrawlSitemapDialog

UrlListPage
├── FilterBar                         ← declarative schema → URL search params
│   ├── SearchInput (debounced)
│   ├── FilterSelect × N (score, status code, errors, warnings, canonical, noindex, dup title)
│   └── ActiveFilterChips + ClearAll
├── DataTable (TanStack headless)
│   ├── SelectionColumn (bulk)
│   ├── SortableHeader × N            ← aria-sort
│   └── UrlRow (a real <Link>, keyboard-operable)
├── BulkActionBar                     ← recrawl · export · compare
└── Pagination (cursor-based)

UrlReportPage
├── StickyUrlSummary                  ← URL · scores · status · crawl date (always visible)
├── SectionRail                       ← scroll-spy nav
└── ReportSection × 14                ← each independent: own query, own error, own skeleton
    └── (Overview, Headings, Meta, Content, Images, Links, Technical,
         Schema, HtmlValidation*, Accessibility*, Performance*,
         BestPractices*, Recommendations, Export)          * = Phase 4

CompareView
├── TargetPicker × 2                  ← two URLs, or two crawls
└── DiffPanel × N                     ← meta · headings · schema · content · links
```

Every `ReportSection` implements one interface, which is what makes them independent and
individually shippable:

```ts
interface ReportSectionProps {
  snapshotId: string;
  crawlId: string;
  /** Sections render their own skeleton/error; the page never blocks on one. */
}
```

---

## 6. Page hierarchy

| Route | Screen | Phase |
| --- | --- | --- |
| `/` | Dashboard — workspace roll-up, recent crawls, attention list | 2 |
| `/projects` | Projects list | 1 |
| `/projects/[slug]` | **Project dashboard — category cards** | 1 |
| `/projects/[slug]/categories/[groupId]` | Category overview: health, trend, crawl history | 1 |
| `/projects/[slug]/categories/[groupId]/urls` | **URL list — filter/sort/paginate/bulk** | 2 |
| `/urls/[snapshotId]` | **URL report — 14 sections** | 3 |
| `/projects/[slug]/compare?base=&head=` | Crawl vs crawl (regression view) | 3 |
| `/compare?a=&b=` | URL vs URL | 3 |
| `/reports` | Global crawl feed *(exists)* | — |
| `/projects/[slug]/settings` | Project + category settings | 2 |

Retained but demoted (still reachable, no longer the primary path): `/websites/[id]/*`,
`/crawls/[id]/*`.

---

## 7. State management improvements

| Concern | Today | Proposed |
| --- | --- | --- |
| **Server state** | TanStack Query, `staleTime 30s` | Keep. Add **`staleTime: Infinity` for completed-crawl data** — snapshots are immutable, so re-fetching them is pure waste. |
| **Pagination** | Hardcoded `limit=100`, cursor ignored | `useInfiniteQuery` + cursor for lists; **server-side** pagination for the URL table. |
| **Filters/sort/page** | Local `useState`, ephemeral | **`useTableState`** → serialised to `useSearchParams`. Shareable, bookmarkable, back-safe. |
| **Query keys** | Inconsistent (`['crawls','detail',id]` vs `['crawls',id,'pages']`); filters spread ad hoc | A single **query-key registry** in `services/query-keys.ts`. Entity-first everywhere; filters as a structured object so prefix invalidation is reliable. |
| **Live crawl** | SSE on the crawl page only, plus 2 s/4 s polling | SSE into a **global progress store** (React context) feeding the dock; drop the polling fallbacks where SSE is live. |
| **Theme** | `document.classList` mutated directly; unobservable | `ThemeProvider` context so charts can react to theme (fixes the hex-colour bug, P7). |
| **Toasts** | None | `ToastProvider` + a `useMutationToast` wrapper so no mutation error is silently swallowed. |
| **Auth scaffolding** | `AuthGuard`/`AuthProvider`/`RoleChip` are dead | **Delete.** Re-introduce when auth returns. |
| **Forms** | RHF+zod in 2 modals; plain `useState` in others | RHF + zod everywhere; **share the zod schema with the API DTO** via `packages/shared`. |

---

## 8. API changes

### 8.1 New — sitemap groups (Phase 1)

```
GET    /projects/:projectId/sitemap-groups          → list (with latest-crawl summary inlined)
POST   /projects/:projectId/sitemap-groups          → { websiteId, name, sitemapUrl }
GET    /sitemap-groups/:groupId                     → detail
PATCH  /sitemap-groups/:groupId                     → rename / change sitemap / activate
DELETE /sitemap-groups/:groupId
POST   /sitemap-groups/:groupId/preview             → parse sitemap, return URL count + sample
                                                      (no crawl — validates before committing)
POST   /sitemap-groups/:groupId/crawls              → start a crawl scoped to this group
GET    /sitemap-groups/:groupId/crawls              → crawl history for this group
GET    /sitemap-groups/:groupId/summary             → THE DASHBOARD CARD PAYLOAD (solves B8)
                                                      { totalUrls, lastCrawl, status, healthScore,
                                                        brokenUrls, errors, warnings, trend[] }
```

`POST /sitemap-groups/:groupId/preview` is deliberately included: it lets the user paste
`https://www.bikedekho.com/sitemap.xml`, see *"Found 1 240 URLs across 3 nested sitemaps"*,
and confirm — before a crawl is committed.

### 8.2 New — URL list & report (Phase 2–3)

```
GET /crawls/:crawlId/urls          → the URL table. Server-side:
                                     ?q= &status= &minScore= &maxScore= &hasErrors=
                                     &hasWarnings= &httpStatus= &canonicalIssue= &noindex=
                                     &duplicateTitle= &sort= &dir= &limit= &cursor=
GET /snapshots/:snapshotId         → full report payload (artifacts + issues + schema + links)
GET /snapshots/:snapshotId/links   → paginated links w/ live HTTP status  (solves B9)
GET /snapshots/:snapshotId/images  → images w/ alt/dimension analysis
GET /crawls/:crawlId/duplicates    → duplicate groups                     (solves B10)
GET /crawls/:crawlId/broken-links  → broken links across the crawl        (solves B9)
POST /compare                      → { a: snapshotId, b: snapshotId } → structured diff
```

### 8.3 Changed

| Endpoint | Change |
| --- | --- |
| `POST /websites/:id/crawls` | Accept `sitemapGroupId`. Extend `scope` to `'site' \| 'page' \| 'group'`. |
| `GET /crawls` | Add `?sitemapGroupId=`, and inline `groupName` in the response. |
| Crawl conflict guard | **Scope the 409 to the group, not the website** (fixes B2). |

### 8.4 Global search (Phase 2–3)

The brief asks for global search across **URL, Title, Meta and Heading**. This is not a
`LIKE` query — the data shape makes each of the four a different problem:

| Target | Where it lives today | Feasibility |
| --- | --- | --- |
| **URL** | `pages.url` — a real column, already indexed `text_pattern_ops` | ✅ Easy. Prefix/substring search works now. |
| **Title** | `artifacts->>'title'` (JSONB) | ⚠️ Needs a `tsvector` or trigram index — a bare JSONB extraction on a partitioned table will full-scan. |
| **Meta description** | `artifacts->>'metaDescription'` (JSONB) | ⚠️ Same. |
| **Heading** | `artifacts->'headings'` — a nested JSON **array** of `{level, text}` | ⚠️ Hardest. Requires flattening; a GIN index on the array, or a generated `headings_text` column. |
| **Body content** | **Not stored at all** (only `wordCount` survives extraction) | ❌ Impossible until Phase 3 adds `content_text`. |

Proposed:

```sql
-- Phase 2: make title/meta/heading searchable without a full scan.
ALTER TABLE page_snapshots ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(artifacts->>'title', '')), 'A') ||
    setweight(to_tsvector('english', coalesce(artifacts->>'metaDescription', '')), 'B') ||
    setweight(to_tsvector('english',
      coalesce(jsonb_path_query_array(artifacts, '$.headings[*].text')::text, '')), 'C')
  ) STORED;
CREATE INDEX idx_snapshots_search ON page_snapshots USING gin (search_tsv);
```

A **generated column** rather than a trigger: it cannot drift from `artifacts`, and it
back-fills automatically. Weighting title above meta above headings gives sane ranking for
free.

```
GET /search?q=&projectId=&groupId=&crawlId=&type=url|title|meta|heading
    → grouped results { urls[], titles[], metas[], headings[] } with rank + snapshot ids
```

The UI is a `⌘K` command palette in the TopBar, scoped to the current project by default
with an "all projects" escape hatch. **Body-content search is explicitly deferred to Phase 3**,
because it cannot exist until `content_text` is persisted (§9.3).

### 8.5 Phase 4 (audits)

```
GET /snapshots/:snapshotId/audit   → { performance, accessibility, bestPractices, htmlValidation }
```

---

## 9. Database changes

### 9.1 Migration `1752300000000_sitemap-groups.sql` (Phase 1)

```sql
-- A named, independently-crawlable slice of a website (e.g. "Model Pages").
CREATE TABLE sitemap_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  name          text NOT NULL,                    -- "Model Pages"
  slug          citext NOT NULL,                  -- "model-pages"
  sitemap_url   text,                             -- NULL ⇒ manual/discovery group
  url_source_id uuid REFERENCES url_sources(id) ON DELETE SET NULL,
  is_active     boolean NOT NULL DEFAULT true,
  settings      jsonb NOT NULL DEFAULT '{}',      -- per-group maxUrls, renderPolicy, …
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, slug)
);
CREATE INDEX idx_sitemap_groups_website ON sitemap_groups (website_id) WHERE is_active;

-- Crawls become group-scoped. NULL = whole-website crawl (preserves today's semantics).
ALTER TABLE crawls ADD COLUMN sitemap_group_id uuid REFERENCES sitemap_groups(id) ON DELETE SET NULL;
ALTER TABLE crawls DROP CONSTRAINT crawls_scope_check;   -- was ('site','page')
ALTER TABLE crawls ADD CONSTRAINT crawls_scope_check CHECK (scope IN ('site','page','group'));
ALTER TABLE crawls ADD CONSTRAINT crawls_group_scope_needs_group
  CHECK (scope <> 'group' OR sitemap_group_id IS NOT NULL);
CREATE INDEX idx_crawls_group ON crawls (sitemap_group_id, created_at DESC);

-- Page↔group is MANY-TO-MANY: a URL can legitimately appear in two sitemaps.
-- (`pages` is UNIQUE(website_id, url_hash), so a page row cannot carry a single group_id.)
CREATE TABLE page_sitemap_groups (
  page_id          uuid NOT NULL,
  sitemap_group_id uuid NOT NULL REFERENCES sitemap_groups(id) ON DELETE CASCADE,
  lastmod          timestamptz,        -- from the sitemap — fixes B6, powers cheap incrementals
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_id, sitemap_group_id)
);
CREATE INDEX idx_psg_group ON page_sitemap_groups (sitemap_group_id);

-- Per-category trends. The existing trend_daily PK is (website_id, day) — one row per
-- website per day — which makes per-category trends impossible (B4). Parallel table
-- rather than a destructive PK change, so existing website trends keep working.
CREATE TABLE trend_daily_group (
  sitemap_group_id uuid NOT NULL REFERENCES sitemap_groups(id) ON DELETE CASCADE,
  day              date NOT NULL,
  crawl_id         uuid NOT NULL,
  seo_score        numeric(5,2) NOT NULL,
  metrics          jsonb NOT NULL,
  PRIMARY KEY (sitemap_group_id, day)
);
```

**Backfill:** every existing `url_sources` row of type `sitemap` becomes a `sitemap_groups`
row named after its host/path; existing crawls keep `sitemap_group_id = NULL` and continue
to behave exactly as they do today. **The migration is non-destructive and backward
compatible.**

### 9.2 Code changes forced by the migration

| Location | Change |
| --- | --- |
| `crawls.repository.ts:58` `findActiveForWebsite` | → `findActiveForGroup` (fixes **B2**) |
| `crawls.repository.ts:69` `findPreviousCompleted` | Filter by `sitemap_group_id` (fixes **B3**) |
| `url-resolver.service.ts:51` | Accept a `groupId` filter; stop merging all sources (fixes **B1**) |
| `url-resolver.service.ts:96` | **Persist `lastmod`** into `page_sitemap_groups` (fixes **B6**) |
| `crawl-config.ts:50`, `sitemap.ts:15` | Make `maxUrls`/`maxSitemaps` per-group settings (fixes **B7**) |
| `orchestrate.processor.ts` | Branch on `scope === 'group'` |
| `page-processor.service.ts:145` | Pass `linkStatuses` (fixes **C2**) |
| `page-processor.service.ts:290` | Enqueue image `src` for link-checking (fixes **C3**) |
| `finalize.processor.ts` | **Recompute snapshot scores** after duplicate/broken-link issues (fixes **C1**) |

### 9.3 Phase 3 — content storage

```sql
ALTER TABLE page_snapshots ADD COLUMN content_text text;   -- extracted body text
```
Needed for keyword density, reading time, thin-content detection and near-duplicate
analysis (spec §4). Currently only `wordCount` survives extraction.

### 9.4 Phase 4 — audits

```sql
CREATE TABLE page_audits (
  snapshot_id  uuid PRIMARY KEY,
  crawl_id     uuid NOT NULL,
  performance  jsonb,   -- LCP, CLS, INP, TTFB, FCP, TBT, resource counts, byte weights
  accessibility jsonb,  -- axe-core violations
  best_practices jsonb,
  html_validation jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```
A **separate table, not new columns on `page_snapshots`** — audits are expensive, sampled,
and optional, so they must not bloat the hot partitioned table that every list query reads.

---

## 10. Reusable components list

**Primitives** (new — none of these exist today)
`Button` (variants: primary/secondary/ghost/destructive × sm/md/lg) · `IconButton` ·
`Input` · `Textarea` · `Select` · `Combobox` · `Checkbox` · `Radio` · `Switch` ·
`Badge` · `Chip` · `Tooltip` · `Popover` · `DropdownMenu` · `Dialog` (with focus trap) ·
`Drawer` · `Tabs` · `Accordion` · `Toast` · `Skeleton` · `Spinner` · `Separator` ·
`ScrollArea` · `CopyButton`

**Data**
`DataTable` (TanStack headless: sort, select, sticky header, column visibility,
virtualization) · `Pagination` · `FilterBar` (declarative schema → URL params) ·
`ActiveFilters` · `BulkActionBar` · `SearchInput` (debounced) · `ColumnPicker` ·
`ExportMenu` (replaces the 3× duplicated CSV/JSON button pair)

**Charts** (theme-aware, tokenised)
`LineChart` · `AreaChart` · `BarChart` · `DonutChart` · `Sparkline` · `ScoreGauge` ·
`HealthMeter` · `TrendDelta`

**Domain**
`ScoreBadge` · `SeverityBadge` · `StatusChip` · `HealthGauge` · `CategoryCard` ·
`CrawlProgressDock` · `CrawlStatusChip` · `UrlCell` (truncating, copyable, external-link) ·
`CheckResultRow` (Problem/Reason/Impact/Fix/Reference) · `SchemaEntityTree` ·
`RichResultBadge` · `DiffView` · `HeadingTree` · `ImageGrid` · `LinkTable`

**Feedback**
`QueryBoundary` (skeleton slot + retry button) · `EmptyState` (icon slot) · `ErrorState` ·
`ConfirmDialog` (replaces `window.confirm()`)

**Layout**
`AppShell` · `SidebarNav` · `TopBar` · `Breadcrumbs` (fixed to cover all routes) ·
`PageHeader` · `Section` · `StickySummary` · `SectionRail`

---

## 11. Design system proposal

**Principle: tokens first.** The single highest-leverage change in the frontend is to stop
writing `text-slate-500 dark:text-slate-400` forty times and instead define a **semantic
token layer** in CSS variables, consumed by Tailwind v4's `@theme`. Dark mode then becomes
*one* variable swap instead of a second class on every element.

```css
/* styles/tokens.css */
@theme {
  --color-bg:            var(--bg);
  --color-surface:       var(--surface);
  --color-surface-hover: var(--surface-hover);
  --color-border:        var(--border);
  --color-text:          var(--text);
  --color-text-muted:    var(--text-muted);
  --color-primary:       var(--primary);
  --color-success:       var(--success);
  --color-warning:       var(--warning);
  --color-danger:        var(--danger);
  /* severity */
  --color-critical:      var(--critical);
  --color-high:          var(--high);
  --color-medium:        var(--medium);
  --color-low:           var(--low);
  --color-info:          var(--info);
}

:root {                         /* light */
  --bg: #ffffff;            --surface: #ffffff;      --surface-hover: #f8fafc;
  --border: #e2e8f0;        --text: #0f172a;         --text-muted: #64748b;
  --primary: #2563eb;       --success: #059669;      --warning: #d97706;  --danger: #dc2626;
  --critical: #dc2626; --high: #ea580c; --medium: #d97706; --low: #0891b2; --info: #64748b;
}
.dark {
  --bg: #0b1120;            --surface: #0f172a;      --surface-hover: #1e293b;
  --border: #1e293b;        --text: #f1f5f9;         --text-muted: #94a3b8;
  --primary: #3b82f6;       --success: #10b981;      --warning: #f59e0b;  --danger: #ef4444;
  --critical: #ef4444; --high: #fb923c; --medium: #fbbf24; --low: #22d3ee; --info: #94a3b8;
}
```

Consequences:
- `bg-surface`, `text-muted`, `border-border` replace every doubled utility pair.
- **Charts read the same tokens** via `getComputedStyle`, fixing the dark-mode chart bug (P7).
- Severity colour is defined **once**, killing the current three-way duplication
  (`badges.tsx` classes / `charts.tsx` hex / `schema/page.tsx` hex).
- Re-branding = editing one file.

**Other system rules**
- **Elevation:** flat. Borders, not shadows (Vercel/Linear idiom). Shadow only for overlays.
- **Radius:** `sm 4 · md 6 · lg 8 · xl 12 · full`. Cards `lg`, inputs/buttons `md`.
- **Spacing:** 4 px base scale (Tailwind default), page gutter 24/32 px.
- **Density:** table rows 44 px — a 1 240-row SEO table is a working surface, not a marketing page.
- **Motion:** 150 ms ease-out; respect `prefers-reduced-motion`.
- **Never colour-only.** Severity always pairs colour + icon + label (WCAG 1.4.1).

**Recommended dependencies** (the app currently has *zero* UI libraries):

| Need | Proposal | Why |
| --- | --- | --- |
| Table | **`@tanstack/react-table`** (headless) | Sort/select/visibility/virtualize; already the documented intent in `07-frontend.md`. |
| Primitives | **Radix UI** | Focus trap, ARIA, keyboard nav — fixes most of P9 for free. |
| Variants | **`cva` + `tailwind-merge`** | Kills string concatenation (P2). |
| Charts | **Recharts** | Axes, tooltips, legends, responsive. Replaces the hand-rolled SVG (P7). |
| Toasts | **`sonner`** | Fixes P8. |
| URL state | **`nuqs`** | Type-safe search-param state (U4/P5). |

Total added bundle ≈ 90 KB gzipped — a sound trade for removing ~700 lines of hand-rolled,
buggy, inaccessible UI primitives.

---

## 12. Colour palette

Neutral-first, in the Datadog/Vercel/Linear idiom: a near-monochrome shell so that **the
only saturated colour on screen is data**.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Background | `#ffffff` | `#0b1120` | Page |
| Surface | `#ffffff` | `#0f172a` | Cards, table |
| Surface hover | `#f8fafc` | `#1e293b` | Row hover |
| Border | `#e2e8f0` | `#1e293b` | Hairlines |
| Text | `#0f172a` | `#f1f5f9` | Primary |
| Text muted | `#64748b` | `#94a3b8` | Secondary |
| **Primary** | `#2563eb` | `#3b82f6` | Actions, links, focus ring |

**Severity** (identical semantics in charts, badges and text — one source of truth)

| Severity | Light | Dark |
| --- | --- | --- |
| Critical | `#dc2626` | `#ef4444` |
| High | `#ea580c` | `#fb923c` |
| Medium | `#d97706` | `#fbbf24` |
| Low | `#0891b2` | `#22d3ee` |
| Info | `#64748b` | `#94a3b8` |

**Health score** (gauges, score cells — thresholds currently hardcoded at `charts.tsx:184`,
to be tokenised)

| Band | Colour | Meaning |
| --- | --- | --- |
| 90–100 | `#059669` / `#10b981` | Healthy |
| 70–89 | `#d97706` / `#f59e0b` | Needs attention |
| 0–69 | `#dc2626` / `#ef4444` | Failing |

All pairs verified against **WCAG AA (4.5:1)** on their own surface in both themes.

---

## 13. Typography

| Token | Family | Use |
| --- | --- | --- |
| `--font-sans` | **Inter** (`next/font`, variable, self-hosted) | UI |
| `--font-mono` | **JetBrains Mono** | URLs, code, JSON-LD, hashes |

URLs are **always mono** — it makes long paths scannable and diffable, which matters on a
table of 1 240 of them.

| Style | Size / Line | Weight | Use |
| --- | --- | --- | --- |
| Display | 30 / 36 | 600 | Project title |
| H1 | 24 / 32 | 600 | Page title |
| H2 | 18 / 28 | 600 | Section |
| H3 | 15 / 24 | 600 | Card title |
| Body | 14 / 20 | 400 | Default |
| Small | 13 / 18 | 400 | Table cells, secondary |
| Caption | 12 / 16 | 500 | Labels, chips |
| Mono | 13 / 20 | 400 | URLs, code |

14 px body (not 16) is deliberate: this is a dense internal data tool, and it matches the
reference products named in the brief.

---

## 14. Wireframes

**Project dashboard — the new landing screen**

```
┌────────────┬──────────────────────────────────────────────────────────────────────┐
│ SEO Guard  │  Projects › BikeDekho                          [⌘K]  [◐]            │
│            ├──────────────────────────────────────────────────────────────────────┤
│ ▸ Dashboard│  BikeDekho                                  [+ New category] [Crawl all]│
│ ▸ Projects │  www.bikedekho.com · 7 categories · 24,180 URLs                      │
│ ▸ Reports  │                                                                       │
│            │  ┌─────────────────────────┐ ┌─────────────────────────┐            │
│ BIKEDEKHO  │  │ Model Pages        ● ok │ │ Compare Pages   ◐ crawl │            │
│  Model     │  │                         │ │                         │            │
│  Compare   │  │   ╭───╮  1,240 URLs     │ │   ╭───╮  890 URLs       │            │
│  Specs     │  │   │ 87│  Last: 2h ago   │ │   │ 72│  Running 41%    │            │
│  News      │  │   ╰───╯  ▁▂▃▅▆▅▇ 30d    │ │   ╰───╯  ▓▓▓▓░░░░       │            │
│  Reviews   │  │                         │ │                         │            │
│  Dealers   │  │  ⛔ 12 errors           │ │  ⛔ 31 errors           │            │
│  Upcoming  │  │  ⚠ 148 warnings        │ │  ⚠ 92 warnings         │            │
│            │  │  🔗 7 broken           │ │  🔗 3 broken           │            │
│            │  │                         │ │                         │            │
│            │  │  [Crawl sitemap] [View] │ │  [Pause]        [View]  │            │
│            │  └─────────────────────────┘ └─────────────────────────┘            │
│            │  ┌─────────────────────────┐ ┌─────────────────────────┐            │
│            │  │ Specs Pages     ○ never │ │ News            ● ok    │  …         │
│            │  │  Not crawled yet        │ │   ╭───╮  2,301 URLs     │            │
│            │  │  [Add sitemap]          │ │   │ 94│                 │            │
│            │  └─────────────────────────┘ └─────────────────────────┘            │
└────────────┴──────────────────────────────────────────────────────────────────────┘
   every number is a link into a pre-filtered URL list
```

**Crawl sitemap dialog** — preview before commit

```
┌ Crawl sitemap — Model Pages ──────────────────────────┐
│                                                        │
│ Sitemap URL                                            │
│ ┌────────────────────────────────────────────────────┐ │
│ │ https://www.bikedekho.com/sitemap-models.xml       │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ✓ Found 1,240 URLs across 3 nested sitemaps           │
│   /bikes/hero-splendor · /bikes/honda-shine · …       │
│                                                        │
│ Mode  (•) Incremental — only changed pages            │
│       ( ) Full — re-fetch every page                  │
│                                                        │
│                          [Cancel]  [Start crawl]      │
└────────────────────────────────────────────────────────┘
```

**Crawl progress dock** — global, SSE-driven

```
                        ┌ Model Pages · crawling ──────── ✕ ┐
                        │ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  41%        │
                        │ Collected  1,240 / 1,240          │
                        │ Analyzed     500 / 1,240          │
                        │ Remaining        740              │
                        │ ETA          2m 30s               │
                        │ /bikes/honda-shine-125            │
                        └───────────────────────────────────┘
```

**URL list**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Model Pages › URLs                            [Export ▾] [Compare] [Recrawl]     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 search url…   Score ▾  Status ▾  Errors ▾  Warnings ▾  Canonical ▾  Noindex ▾ │
│ ● score<70 ✕   ● has errors ✕                              Clear all · 43 results │
├──┬───────────────────────────────┬──────┬─────┬─────┬──────┬────────┬───┬────────┤
│☐ │ URL                       ▲▼  │ Stat │Heal │ SEO │ Perf │ HTTP   │ ⛔│ ⚠      │
├──┼───────────────────────────────┼──────┼─────┼─────┼──────┼────────┼───┼────────┤
│☑ │ /bikes/hero-splendor-plus     │  ok  │ 87  │ 91  │  —   │  200   │ 0 │  3     │
│☑ │ /bikes/honda-shine-125        │  ok  │ 62  │ 58  │  —   │  200   │ 2 │  9     │
│☐ │ /bikes/tvs-raider-125         │ warn │ 71  │ 74  │  —   │  200   │ 0 │  5     │
│☐ │ /bikes/bajaj-pulsar-n160      │ err  │ 34  │ 30  │  —   │  404   │ 5 │ 12     │
├──┴───────────────────────────────┴──────┴─────┴─────┴──────┴────────┴───┴────────┤
│ ▸ 2 selected: [Recrawl] [Export] [Compare]         ‹ 1 2 3 … 25 ›  50/page ▾     │
└──────────────────────────────────────────────────────────────────────────────────┘
    Perf column shows "—" until Phase 4 — honest, not fabricated
```

**URL report**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ← Model Pages                                             [Export ▾] [Compare]   │
│ ╔══════════════════════════════════════════════════════════════════════════════╗ │  ← sticky
│ ║ /bikes/honda-shine-125                                          200 · 1.2s   ║ │
│ ║ Honda Shine 125 Price, Images, Mileage & Specs                               ║ │
│ ║  Health 62   SEO 58   Perf —   A11y —   Crawled 2h ago                       ║ │
│ ╚══════════════════════════════════════════════════════════════════════════════╝ │
├────────────┬─────────────────────────────────────────────────────────────────────┤
│ Overview   │  ⚡ Recommendations                                    9 issues      │
│ ▸Recommend │  ┌───────────────────────────────────────────────────────────────┐  │
│  Headings  │  │ ⛔ CRITICAL · Page is set to noindex                          │  │
│  Meta      │  │ Problem   <meta name="robots" content="noindex">              │  │
│  Content   │  │ Reason    Search engines are told to exclude this page.       │  │
│  Images    │  │ Impact    Page cannot rank. Removes ~100% of organic traffic. │  │
│  Links     │  │ Fix       Remove the noindex directive.                       │  │
│  Technical │  │ Ref       developers.google.com/…/robots-meta-tag        [→]  │  │
│  Schema    │  ├───────────────────────────────────────────────────────────────┤  │
│  HTML   ⏳ │  │ 🔴 HIGH · Meta description missing                            │  │
│  A11y   ⏳ │  │ …                                                             │  │
│  Perf   ⏳ │  └───────────────────────────────────────────────────────────────┘  │
│  Practices⏳│                                                                     │
│  Export    │  ⏳ = arrives in Phase 4                                            │
└────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

## 15. Development plan

**Sequencing principle: unblock the domain model first, then the shell, then the surfaces.**
The `sitemap_groups` migration and the crawl-scoping change are on the critical path for
*everything* — no UI work on categories can start until a crawl can be scoped to a group.
The design-system work is parallelisable and should start immediately alongside it.

```
Phase 0 ── Foundations (parallel tracks)
   Track A (backend)   C1 score recompute · C2 linkStatuses · C3 image link-check · C4 decouple
   Track B (frontend)  tokens.css · primitives (Radix+cva) · DataTable (TanStack) · toasts ·
                       useTableState (nuqs) · delete dead auth scaffolding
   ── no user-visible change; everything after this depends on it

Phase 1 ── Sitemap groups + project-centric IA        ← the core ask
   migration · group-scoped crawls · resolver provenance · lastmod persistence
   group-aware conflict guard + incremental baseline
   /projects/[slug] category dashboard · CategoryCard · crawl dialog w/ preview
   new AppShell + contextual sidebar + fixed breadcrumbs

Phase 2 ── URL list + crawl observability
   GET /crawls/:id/urls (server-side filter/sort/paginate) · broken-links + duplicates API
   URL table · FilterBar · bulk actions · CrawlProgressDock

Phase 3 ── URL report + comparison + export
   sections 1–8, 13, 14 (real data) · Recommendations · content_text · compare · PDF/Excel

Phase 4 ── Audits (the reversal of the documented non-goal)
   audit.processor (Playwright + Lighthouse + axe-core) · page_audits table
   sections 9–12 become real · amend 00-overview.md
```

**Risks**

| Risk | Mitigation |
| --- | --- |
| **Phase 4 crawl cost.** A Lighthouse run is 10–30× an HTML fetch. A 1 240-URL category becomes hours. | Audits are **sampled and opt-in**, on a separate queue with its own concurrency — never inline in the crawl. |
| **Sitemap caps (B7).** Real BikeDekho indexes will exceed 10 000 URLs / 50 nested sitemaps. | Make both per-group settings in Phase 1; surface truncation in the preview dialog. |
| **URL-in-two-sitemaps.** `pages` is `UNIQUE(website_id, url_hash)`. | Modelled as many-to-many (`page_sitemap_groups`) from the start — not a page column. |
| **Migration risk.** | Additive and backward-compatible: `sitemap_group_id` is nullable, `NULL` = today's whole-website crawl. Existing crawls keep working untouched. |

---

## 16. Implementation phases

| Phase | Deliverable | Depends on | Rough size |
| --- | --- | --- | --- |
| **0** | Design tokens · primitives · TanStack table · toasts · URL state · **4 engine bug fixes** | — | **M** |
| **1** | `sitemap_groups` · group-scoped crawls · **project dashboard w/ category cards** · new shell | 0 | **L** |
| **2** | **URL list** (filter/sort/paginate/bulk) · broken-links & duplicates API · progress dock | 1 | **L** |
| **3** | **URL report** (sections 1–8, 13, 14) · recommendations · compare · export | 2 | **L** |
| **4** | **Audits**: performance · accessibility · HTML validation · best practices (sections 9–12) | 3 | **XL** |

**Phase 1 is the smallest increment that delivers the requested workflow end-to-end**
(Projects → Project → Category → Crawl → Results). Phases 2–3 make the results deep. Phase 4
reverses the documented non-goal and is the only phase requiring new infrastructure.

**Recommendation:** approve Phases 0–1 to begin, and review Phase 2 scope once category
crawling is live and real data volumes are visible.
