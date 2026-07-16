"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FinalizeProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalizeProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const seo_engine_1 = require("@seo-guardian/seo-engine");
const schema_engine_1 = require("@seo-guardian/schema-engine");
const shared_1 = require("@seo-guardian/shared");
const bullmq_2 = require("bullmq");
const crawl_state_service_1 = require("../infra/crawl-state.service");
/** Max delay cycles finalize waits for link checks before proceeding anyway. */
const MAX_LINK_WAITS = 30;
/** Effective severity for an emitted check, from the single-source catalog. */
function severityOf(id) {
    return (0, seo_engine_1.getCatalogCheck)(id)?.defaultSeverity ?? shared_1.IssueSeverity.Medium;
}
/**
 * Runs once per crawl when all pages settle: waits for link verification to
 * drain, computes cross-page duplicate and broken-link issues in SQL, derives
 * the site score and dashboard aggregates, and marks the crawl completed.
 * Idempotent — safe to re-run (aggregates upsert; duplicate/broken issues are
 * cleared first).
 */
// Finalize does heavy cross-page SQL over the whole crawl. Give it a long lock
// so a slow-but-healthy run isn't falsely flagged "stalled", and tolerate a few
// stalls (e.g. a worker restart mid-run) before giving up — the reaper is the
// final backstop, but recovering here is cheaper and faster.
let FinalizeProcessor = FinalizeProcessor_1 = class FinalizeProcessor extends bullmq_1.WorkerHost {
    crawls;
    issues;
    linkChecks;
    aggregates;
    schemaEntities;
    changes;
    state;
    logger = new common_1.Logger(FinalizeProcessor_1.name);
    constructor(crawls, issues, linkChecks, aggregates, schemaEntities, changes, state) {
        super();
        this.crawls = crawls;
        this.issues = issues;
        this.linkChecks = linkChecks;
        this.aggregates = aggregates;
        this.schemaEntities = schemaEntities;
        this.changes = changes;
        this.state = state;
    }
    async process(job, token) {
        const { crawlId } = job.data;
        const crawl = await this.crawls.findById(crawlId);
        if (!crawl)
            return { skipped: 'crawl gone' };
        if (await this.state.isCancelled(crawlId)) {
            await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Cancelled);
            await this.state.cleanup(crawlId);
            return { cancelled: true };
        }
        // Wait for outstanding link-check batches, bounded so a leaked counter can't hang the crawl.
        const waits = job.data._waits ?? 0;
        if ((await this.state.getLinkBatches(crawlId)) > 0 && waits < MAX_LINK_WAITS) {
            job.data = { ...job.data, _waits: waits + 1 };
            await job.moveToDelayed(Date.now() + 1000, token);
            throw new bullmq_2.DelayedError();
        }
        await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Finalizing);
        // Cross-page duplicate issues (title/description/h1).
        const dup = [
            { hash: 'titleHash', sample: 'title', id: seo_engine_1.CHECK_IDS.DUPLICATE_TITLE, field: 'title' },
            {
                hash: 'descriptionHash',
                sample: 'metaDescription',
                id: seo_engine_1.CHECK_IDS.DUPLICATE_DESCRIPTION,
                field: 'meta_description',
            },
            { hash: 'h1Hash', sample: 'h1Text', id: seo_engine_1.CHECK_IDS.DUPLICATE_H1, field: 'h1' },
        ];
        let duplicateIssues = 0;
        for (const d of dup) {
            duplicateIssues += await this.issues.insertDuplicateIssues({
                crawlId,
                websiteId: crawl.websiteId,
                hashField: d.hash,
                sampleField: d.sample,
                checkId: d.id,
                severity: severityOf(d.id),
                duplicateField: d.field,
            });
        }
        // Broken-link issues joined from link_checks onto referencing pages.
        const brokenLinkIssues = await this.issues.insertBrokenLinkIssues({
            crawlId,
            internalCheckId: seo_engine_1.CHECK_IDS.LINK_INTERNAL_BROKEN,
            internalSeverity: severityOf(seo_engine_1.CHECK_IDS.LINK_INTERNAL_BROKEN),
            externalCheckId: seo_engine_1.CHECK_IDS.LINK_EXTERNAL_BROKEN,
            externalSeverity: severityOf(seo_engine_1.CHECK_IDS.LINK_EXTERNAL_BROKEN),
        });
        // Broken images and over-long redirect chains. Both depend on link_checks,
        // which only exists once verification has drained — so, like broken links,
        // they can only be evaluated here and never by the per-page runner.
        const brokenImageIssues = await this.issues.insertBrokenImageIssues({
            crawlId,
            checkId: seo_engine_1.CHECK_IDS.IMAGE_SRC_BROKEN,
            severity: severityOf(seo_engine_1.CHECK_IDS.IMAGE_SRC_BROKEN),
        });
        const redirectChainIssues = await this.issues.insertRedirectChainIssues({
            crawlId,
            checkId: seo_engine_1.CHECK_IDS.LINK_REDIRECT_CHAIN,
            severity: severityOf(seo_engine_1.CHECK_IDS.LINK_REDIRECT_CHAIN),
            maxHops: seo_engine_1.MAX_REDIRECT_HOPS,
        });
        // Every deduction above landed in page_issues *after* the per-page score was
        // written. Recompute scores and issue counts from the complete issue set, or
        // the site average is a mean of stale numbers.
        const rescored = await this.issues.recomputeSnapshotScores(crawlId);
        // Schema change detection vs the previous completed crawl of the SAME scope —
        // baselining a category against a different category would diff two unrelated
        // URL sets.
        const schemaChanges = await this.detectSchemaChanges(crawlId, crawl.websiteId, crawl.sitemapGroupId);
        const metrics = await this.computeAggregates(crawlId, crawl.websiteId, crawl.sitemapGroupId);
        await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Completed);
        const counters = await this.state.getCounters(crawlId);
        await this.state.publish({
            ...this.state.buildProgress(crawlId, shared_1.CrawlStatus.Completed, counters),
            finishedAt: new Date().toISOString(),
        });
        await this.state.cleanup(crawlId);
        this.logger.log(`crawl ${crawlId} finalized: score=${metrics.seoScore}, dupIssues=${duplicateIssues}, ` +
            `brokenLinkIssues=${brokenLinkIssues}, brokenImages=${brokenImageIssues}, ` +
            `redirectChains=${redirectChainIssues}, rescored=${rescored}, ` +
            `schemaEntities=${metrics.schemaEntities}, schemaChanges=${schemaChanges}`);
        return {
            seoScore: metrics.seoScore,
            duplicateIssues,
            brokenLinkIssues,
            brokenImageIssues,
            redirectChainIssues,
            rescored,
            schemaChanges,
        };
    }
    /**
     * Diffs this crawl's schema entities against the previous completed crawl,
     * per page, and records the changes. First crawl of a website has no baseline.
     */
    async detectSchemaChanges(crawlId, websiteId, sitemapGroupId) {
        const previous = await this.crawls.findPreviousCompleted(websiteId, crawlId, sitemapGroupId);
        if (!previous)
            return 0;
        // The union of pages carrying schema in either crawl, fetched without any
        // jsonb so this stays cheap even for a very large site. The actual entity
        // properties — which can total hundreds of MB — are only ever loaded one
        // page-batch at a time below, so the heap footprint is bounded regardless of
        // crawl size (loading it all at once previously OOM-killed the worker).
        const [currentPageIds, previousPageIds] = await Promise.all([
            this.schemaEntities.pageIdsWithSchema(crawlId),
            this.schemaEntities.pageIdsWithSchema(previous.id),
        ]);
        const pageIds = [...new Set([...currentPageIds, ...previousPageIds])];
        if (pageIds.length === 0)
            return 0;
        const BATCH = 50;
        let total = 0;
        for (let i = 0; i < pageIds.length; i += BATCH) {
            const batch = pageIds.slice(i, i + BATCH);
            const [currentRows, previousRows] = await Promise.all([
                this.schemaEntities.loadSummariesForPages(crawlId, batch),
                this.schemaEntities.loadSummariesForPages(previous.id, batch),
            ]);
            const currentByPage = groupByPage(currentRows);
            const previousByPage = groupByPage(previousRows);
            const records = [];
            for (const pageId of batch) {
                const before = (previousByPage.get(pageId) ?? []).map(toEngineSummary);
                const after = (currentByPage.get(pageId) ?? []).map(toEngineSummary);
                for (const change of (0, schema_engine_1.diffPageSchema)(before, after)) {
                    records.push({
                        pageId,
                        changeType: change.type,
                        severity: change.severity,
                        before: change.before ?? { entityType: change.entityType, property: change.property },
                        after: change.after ?? null,
                    });
                }
            }
            if (records.length > 0)
                total += await this.changes.insertMany(crawlId, websiteId, records);
        }
        return total;
    }
    async computeAggregates(crawlId, websiteId, sitemapGroupId) {
        const comps = await this.aggregates.scoreComponents(crawlId);
        const avg = comps?.avgScore != null ? Number(comps.avgScore) : 100;
        const scored = comps?.scoredPages ?? 0;
        const criticalPages = comps?.criticalPages ?? 0;
        // Category floor (docs/06 §4): critical issues on >10% of pages cap the site at 79.
        const criticalShare = scored > 0 ? criticalPages / scored : 0;
        const seoScore = Number((criticalShare > 0.1 ? Math.min(avg, 79) : avg).toFixed(2));
        const severity = await this.issues.countsBySeverity(crawlId);
        const bySeverity = {};
        for (const s of severity)
            bySeverity[s.severity] = s.count;
        const broken = await this.linkChecks.countBroken(crawlId);
        // Schema coverage rollup.
        const [coverage, typeFreq, statusCounts, richSummary] = await Promise.all([
            this.schemaEntities.coverage(crawlId),
            this.schemaEntities.typeFrequency(crawlId),
            this.schemaEntities.statusCounts(crawlId),
            this.schemaEntities.richResultSummary(crawlId),
        ]);
        const schemaStatus = {};
        for (const s of statusCounts)
            schemaStatus[s.status] = s.count;
        const metrics = {
            scoringVersion: 1,
            pagesScored: scored,
            criticalPages,
            issuesBySeverity: bySeverity,
            brokenLinks: broken?.count ?? 0,
            schema: {
                totalEntities: coverage.totalEntities,
                pagesWithSchema: coverage.pagesWithSchema,
                pagesWithoutSchema: Math.max(0, scored - coverage.pagesWithSchema),
                richEligible: coverage.richEligible,
                byStatus: schemaStatus,
                typeFrequency: typeFreq.slice(0, 50),
                richResults: richSummary,
            },
        };
        await this.aggregates.upsert({ crawlId, websiteId, seoScore, metrics });
        await this.aggregates.upsertTrendDay({ websiteId, crawlId, seoScore, metrics });
        if (sitemapGroupId) {
            // The category's own history, which the dashboard card's sparkline reads.
            await this.aggregates.upsertGroupTrendDay({ sitemapGroupId, crawlId, seoScore, metrics });
        }
        return { seoScore, schemaEntities: coverage.totalEntities };
    }
};
exports.FinalizeProcessor = FinalizeProcessor;
exports.FinalizeProcessor = FinalizeProcessor = FinalizeProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(shared_1.QUEUES.CRAWL_FINALIZE, {
        concurrency: 2,
        lockDuration: 5 * 60 * 1000,
        maxStalledCount: 5,
    }),
    __metadata("design:paramtypes", [db_1.CrawlsRepository,
        db_1.PageIssuesRepository,
        db_1.LinkChecksRepository,
        db_1.CrawlAggregatesRepository,
        db_1.SchemaEntitiesRepository,
        db_1.CrawlChangesRepository,
        crawl_state_service_1.CrawlStateService])
], FinalizeProcessor);
function groupByPage(rows) {
    const map = new Map();
    for (const row of rows) {
        const list = map.get(row.pageId) ?? [];
        list.push(row);
        map.set(row.pageId, list);
    }
    return map;
}
function toEngineSummary(row) {
    return {
        type: row.schemaType,
        format: row.format,
        identity: row.identity,
        entityHash: row.entityHash,
        status: row.status,
        properties: (row.properties ?? {}),
        richProfiles: Array.isArray(row.richResults)
            ? row.richResults.map((r) => ({
                profile: r.profile,
                status: r.status,
            }))
            : [],
    };
}
//# sourceMappingURL=finalize.processor.js.map