# SEO Guardian AI — Design Overview

**Status:** Phase 3 implemented (crawler + Technical-SEO engine) · **Last updated:** 2026-07-09

SEO Guardian AI is an internal, enterprise-grade **continuous SEO monitoring platform**. It manages unlimited projects and websites, crawls pages automatically on schedules (daily, 6-hourly, weekly, monthly, custom cron), validates Technical SEO and Schema.org implementation against hundreds of rules, stores every crawl as a permanent immutable snapshot, detects regressions between crawls, and presents everything in an interactive dashboard with trend analytics, alerting, and downloadable reports.

This is **not** a one-time SEO checker. It is a monitoring system: every crawl is a snapshot, every snapshot is diffable, and every regression is an alertable event.

**Explicit non-goals:** Lighthouse, Core Web Vitals, PageSpeed, performance scoring, accessibility auditing. The platform measures _SEO correctness_, not speed.

## Primary questions the platform answers

- Is our website SEO compliant, and which pages have issues (by severity)?
- What changed since yesterday — which pages lost schema, became noindex, or changed canonicals?
- Which pages have duplicate metadata or invalid/missing structured data?
- Which SEO problems are trending up, and which were fixed after a deployment?
- What should developers fix first?

## Document index

| Doc                                                    | Contents                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| [01-requirements.md](01-requirements.md)               | Functional requirements, non-functional requirements, user roles & permissions matrix                                           |
| [02-system-architecture.md](02-system-architecture.md) | Component architecture, high-level design, deployment architecture, scaling strategy, key decisions with rationale              |
| [03-database.md](03-database.md)                       | ER diagram, full PostgreSQL DDL, partitioning, indexing & retention strategy                                                    |
| [04-api.md](04-api.md)                                 | Versioned REST API spec: auth, pagination, filtering, bulk ops, async job tracking                                              |
| [05-crawling-pipeline.md](05-crawling-pipeline.md)     | Scheduler, queue topology, fetch/render strategy, incremental crawling, job lifecycle, sequence diagrams                        |
| [06-validation-engines.md](06-validation-engines.md)   | SEO check catalog, Schema.org validation engine, rich-result eligibility, duplicate & change detection, scoring, class diagrams |
| [07-frontend.md](07-frontend.md)                       | UI wireframes, screen inventory, component hierarchy, state management                                                          |
| [08-folder-structure.md](08-folder-structure.md)       | Monorepo layout, package boundaries, dependency rules                                                                           |
| [09-security-testing.md](09-security-testing.md)       | Threat model, authn/authz, SSRF defenses, testing strategy per layer                                                            |
| [10-roadmap-risks.md](10-roadmap-risks.md)             | Phased development roadmap, risk analysis, future enhancements                                                                  |

## Core principles

1. **The validation engine is a pure library.** Every SEO check and schema validator lives in a framework-free TypeScript package with zero I/O. Fetching happens first; validation is a deterministic function of fetched artifacts. Checks are unit-testable with HTML fixtures and reusable from API, workers, and (later) a CLI.
2. **Checks are data-driven.** Each check registers metadata (id, category, default severity, default weight, remediation content). Severity and scoring weights are overridable per project from the database — retuning scoring never requires a redeploy.
3. **Schema.org requirements are data, not code.** The schema.org vocabulary snapshot and Google rich-result requirement profiles are versioned JSON rule packs. Supporting a new type or tracking a Google requirement change is a data update.
4. **Snapshots are immutable.** A crawl never overwrites previous data. History, diffs, trends, and regression reports are all derived from append-only snapshots.
5. **AI explains, never measures.** Every fact in a report comes from the deterministic engine. The AI module only rewrites engine facts into human/developer explanations and prioritization, and its output is cached and clearly attributed.
6. **Everything heavy is a queue job.** The API only enqueues and reads. Workers fetch, render, validate, diff, and persist. This is what lets the system scale from 1 URL to millions of pages and lets crawls be paused, resumed, retried, and cancelled.
7. **Politeness is enforced centrally.** Per-domain concurrency and rate limits live in the queue layer, so scaling workers never turns the platform into a DoS tool against our own properties.

## Tech stack (fixed by requirements)

- **Backend:** NestJS, TypeScript, PostgreSQL, Redis, BullMQ, Playwright (render fallback), Cheerio, AJV
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, React Query, TanStack Table, React Hook Form, Zod, Chart.js
- **Infra:** Docker, S3-compatible object storage for raw HTML, Prometheus-compatible metrics
