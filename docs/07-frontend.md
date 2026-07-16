# 07 — Frontend Design

Next.js (App Router) + TypeScript + Tailwind + React Query + TanStack Table + React Hook Form + Zod + Chart.js. Responsive, dark mode via `class` strategy, keyboard-accessible.

## 1. Screen inventory & routes

```
/login
/                                    → project switcher / global overview (per-role)
/projects/:slug                      → project dashboard (roll-up of websites)
/projects/:slug/settings             → tabs: general · members · checks · notifications · retention
/projects/:slug/sites/:siteId        → WEBSITE DASHBOARD (primary screen)
  /crawls                            → crawl history table + trigger crawl
  /crawls/:crawlId                   → crawl detail: progress (live), stats, changes summary
  /pages                             → page explorer (filter/search, per crawl)
  /pages/:pageId                     → page detail: artifacts, issues, schema, history timeline
  /issues                            → issue explorer (workflow: assign/status/tags, bulk)
  /schema                            → schema explorer: coverage, entities by type, rich results
  /duplicates                        → duplicate groups by field
  /compare?base=&head=               → crawl comparison / regression view
  /trends                            → trend charts with metric picker
  /reports                           → generate/download, history
  /sources                           → sitemaps, CSV upload, discovery config
  /schedules                         → cron schedules
/admin                               → users, global settings, audit logs (role-gated)
```

## 2. Key wireframes

**Website dashboard**

```
┌────────────────────────────────────────────────────────────────────────┐
│ CarDekho ▸ www.cardekho.com          [Run crawl ▾] [Compare] [Report]  │
├──────────────┬──────────────┬───────────────┬──────────────────────────┤
│ SEO SCORE    │ Health       │ Crawl status  │ Next scheduled           │
│    89 ▼-3    │ ● Warning    │ ▓▓▓▓░ 82%     │ Daily · in 6h 12m        │
│ sparkline    │ 12 critical  │ 41.2k/50k     │ (Every day 03:00 IST)    │
├──────────────┴──────────────┴───────────────┴──────────────────────────┤
│ Pages 50,112   Crawled 41.2k   Pending 8.7k   Failed 214   Noindex 89  │
│ Critical 12  High 340  Medium 1.2k  Low 3.4k  Passed 812k  Checks 830k │
│ Schema coverage 94% ▲2   Rich results 71%   Duplicates 412   Broken 74 │
├──────────────────────────────┬─────────────────────────────────────────┤
│ Score trend (30d)   [chart]  │ Issues by category        [stacked bar] │
├──────────────────────────────┴─────────────────────────────────────────┤
│ What changed since yesterday                                            │
│ ⛔ 2 pages lost Article schema (author removed)         → view          │
│ ⚠ 5 canonical changes in /used-cars/*                   → view          │
│ ✅ 71 issues resolved · 34 introduced                    → compare       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Issue explorer**

```
┌ Filters: [Severity ▾][Category ▾][Check ▾][Path /news/*][Status ▾][Assignee ▾][Crawl: Jul 8 ▾] │
├───┬───────────────────────────────┬──────────┬────────┬──────────┬─────────┬────────┤
│ ☐ │ Check                         │ Severity │ Pages  │ Status   │ Assignee│ Trend  │
│ ☐ │ Article schema missing author │ Critical │ 214    │ open     │ —       │ ▲ new  │
│ ☐ │ Title duplicated across site  │ High     │ 1,204  │ in_prog  │ rahul   │ ▬      │
├───┴───────────────────────────────┴──────────┴────────┴──────────┴─────────┴────────┤
│ [Bulk: Assign ▾ · Status ▾ · Tag ▾]                    Row click → drawer:          │
│ drawer: evidence · affected pages (virtualized) · AI explain (on demand) · history  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Page detail** — header (URL, status chip, score, fetch info, rendered badge) · tabs: **Issues** (grouped by category) · **Schema** (entity tree with per-property validation marks, rich-result verdicts with reasons) · **Artifacts** (extracted title/meta/headings/links summary, view-source link to stored HTML while retained) · **History** (timeline of this page's score/title/canonical/schema across crawls).

**Compare view** — two crawl pickers → summary strip (score delta, pages ±, issues ±) → change table filtered by type/severity, each row expandable to before/after diff.

## 3. Component hierarchy

```
app/
  (auth)/login
  (dash)/layout            → AppShell
AppShell
 ├─ SidebarNav (project switcher, site nav, role-aware)
 ├─ TopBar (breadcrumbs, crawl-live indicator, ThemeToggle, UserMenu)
 └─ <page>
Shared domain components
 ├─ ScoreGauge · ScoreDelta · HealthBadge · SeverityBadge · StatusChip
 ├─ StatCard / StatGrid (dashboard counters)
 ├─ TrendChart (Chart.js wrapper: line/area, granularity switch, dark-mode palettes)
 ├─ CategoryBreakdownChart (stacked bar)
 ├─ CrawlProgressBar (SSE-driven)
 ├─ DataTable (TanStack: server pagination via cursor, column filters, row selection,
 │             virtualized bodies for >1k rows, CSV export of current view)
 ├─ FilterBar (declarative filter schema → URL search params, shareable links)
 ├─ IssueDrawer (evidence viewer, AIExplainPanel, AffectedPagesList, WorkflowControls)
 ├─ SchemaEntityTree (recursive entity/property renderer with validation marks)
 ├─ RichResultBadge (eligible / warnings / ineligible + reasons popover)
 ├─ DiffView (before/after field diff)
 ├─ CronScheduleEditor (presets + raw cron with human preview)
 ├─ CsvUploadWizard (parse preview, column mapping, validation errors)
 └─ ReportBuilderModal (type, format, params)
```

## 4. Data & state strategy

- **Server state:** React Query exclusively; query keys mirror API routes (`['site', id, 'dashboard']`); crawl-scoped data is immutable → `staleTime: Infinity` for completed crawls, aggressive caching. Live crawl: SSE subscription updates the progress query cache; dashboard re-fetches on `crawl.completed` event.
- **URL as state:** all explorer filters/sort/cursor serialize to search params — every filtered view is shareable and back-button-safe.
- **Client state:** near none (theme, drawer open) — Zustand-free by default, React context suffices.
- **Forms:** React Hook Form + shared Zod schemas imported from `packages/shared` — the same schema validates in the browser and in the NestJS pipe.
- **Tables at scale:** always server-side pagination/filtering; virtualization for tall lists; no client-side loading of full crawls.
- **Type safety end-to-end:** API response types generated from the OpenAPI doc into `packages/shared` consumers.

## 5. UX conventions

- Severity colors (WCAG AA in both themes): critical red-600/400 · high orange · medium amber · low slate · info blue; never color-only (icons + labels).
- Skeletons for all async panels; empty states explain the next action ("No crawls yet — add a sitemap and run your first crawl").
- Every count on the dashboard is a drill-down link into a pre-filtered explorer.
- Timestamps localized with UTC tooltip; timezone shown wherever cron schedules appear.
