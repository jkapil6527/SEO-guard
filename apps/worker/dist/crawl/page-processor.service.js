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
var PageProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageProcessorService = exports.RateLimitedError = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const db_1 = require("@seo-guardian/db");
const crawler_core_1 = require("@seo-guardian/crawler-core");
const seo_engine_1 = require("@seo-guardian/seo-engine");
const schema_engine_1 = require("@seo-guardian/schema-engine");
const shared_1 = require("@seo-guardian/shared");
const crawl_config_1 = require("./crawl-config");
const crawl_producer_service_1 = require("./crawl-producer.service");
const fetcher_factory_1 = require("./fetcher.factory");
const crawl_state_service_1 = require("../infra/crawl-state.service");
const html_storage_service_1 = require("../infra/html-storage.service");
const politeness_service_1 = require("../infra/politeness.service");
/** Signals that BullMQ should delay-retry the job (politeness backpressure). */
class RateLimitedError extends Error {
    retryInMs;
    constructor(retryInMs) {
        super('rate limited');
        this.retryInMs = retryInMs;
    }
}
exports.RateLimitedError = RateLimitedError;
/**
 * Processes one page end to end: politeness gate, conditional fetch, optional
 * render, artifact extraction, SEO validation, idempotent persistence,
 * discovery expansion, progress publication, and completion detection.
 * Shared by the fetch and render processors.
 */
let PageProcessorService = PageProcessorService_1 = class PageProcessorService {
    crawls;
    pages;
    snapshots;
    schemaEntities;
    producer;
    fetcherFactory;
    storage;
    politeness;
    state;
    config;
    logger = new common_1.Logger(PageProcessorService_1.name);
    constructor(crawls, pages, snapshots, schemaEntities, producer, fetcherFactory, storage, politeness, state, config) {
        this.crawls = crawls;
        this.pages = pages;
        this.snapshots = snapshots;
        this.schemaEntities = schemaEntities;
        this.producer = producer;
        this.fetcherFactory = fetcherFactory;
        this.storage = storage;
        this.politeness = politeness;
        this.state = state;
        this.config = config;
    }
    /** Entry point for the static fetch path. */
    async processFetch(data) {
        if (await this.shouldSkip(data.crawlId))
            return { outcome: 'unchanged' };
        const config = await this.loadConfig(data);
        const fetcher = this.fetcherFactory.create(config);
        await this.gatePoliteness(data.url, config);
        const result = await fetcher.fetch(data.url, {
            etag: data.previous?.etag,
            lastModified: data.previous?.lastModified,
        });
        if (result.notModified && data.previous) {
            return this.carryForward(data);
        }
        // Transport failure, empty body, or an HTTP error status → error snapshot.
        if (result.error || !result.body || result.status >= 400) {
            return this.persistFetchError(data, result);
        }
        const html = result.body.toString('utf8');
        if (config.renderPolicy === 'always' ||
            (config.renderPolicy === 'auto' && this.needsRender(html))) {
            await this.producer.enqueueRender(data, 5);
            return { outcome: 'unchanged', routedToRender: true };
        }
        return this.validateAndPersist(data, config, result, html, false);
    }
    /** Entry point for the Playwright render path (rendered DOM supplied). */
    async processRendered(data, renderedHtml, result) {
        if (await this.shouldSkip(data.crawlId))
            return { outcome: 'unchanged' };
        if (result.error || !renderedHtml || result.status >= 400) {
            return this.persistFetchError(data, result);
        }
        const config = await this.loadConfig(data);
        return this.validateAndPersist(data, config, result, renderedHtml, true);
    }
    async validateAndPersist(data, config, result, html, rendered) {
        const contentHash = (0, node_crypto_1.createHash)('sha256').update(html).digest();
        const contentHashHex = contentHash.toString('hex');
        // Unchanged by content hash (incremental): carry forward without re-validating.
        if (data.previous?.contentHash === contentHashHex) {
            return this.carryForward(data);
        }
        await this.storage.put('raw', contentHashHex, Buffer.from(html, 'utf8')).catch((err) => {
            this.logger.warn({ err, url: data.url }, 'raw html store failed (continuing)');
        });
        const ctx = {
            url: data.url,
            finalUrl: result.finalUrl,
            httpStatus: result.status,
            headers: result.headers,
            redirectChain: result.redirectChain,
            rendered,
        };
        const artifacts = (0, seo_engine_1.extractArtifacts)(html, ctx);
        const ruleResults = (0, seo_engine_1.runChecks)(artifacts, { origin: originOf(data.url), pathScope: '/' });
        const score = (0, seo_engine_1.computePageScore)(ruleResults);
        const issues = this.toIssues(ruleResults);
        const issueCounts = countBySeverity(ruleResults);
        // Schema.org extraction + validation (JSON-LD / Microdata / RDFa).
        const schema = (0, schema_engine_1.validatePageSchema)(html, {
            url: data.url,
            finalUrl: result.finalUrl,
            headers: result.headers,
        });
        const schemaEntities = this.toSchemaEntities(schema);
        const fetchStatus = result.redirectChain.length > 0 ? 'redirected' : 'ok';
        await this.snapshots.replaceSnapshot({
            crawlId: data.crawlId,
            pageId: data.pageId,
            websiteId: data.websiteId,
            fetchStatus,
            httpStatus: result.status,
            redirectChain: result.redirectChain.length > 0 ? result.redirectChain : null,
            contentHash,
            artifacts: {
                ...artifacts,
                etag: artifacts.etag,
                lastModified: artifacts.lastModified,
                schemaSummary: schemaSummary(schema),
            },
            score,
            issueCounts,
            timingMs: { fetch: result.timings.totalMs },
            rendered,
        }, issues, schemaEntities);
        await this.enqueueLinkTargets(data, artifacts);
        // Only spider onward when this page participates in discovery (domain /
        // discovery crawls). List sources (manual, CSV, sitemap) crawl exactly their
        // URLs, so a single specific page stays a single page.
        if (data.discover) {
            await this.expandDiscovery(data, config, artifacts);
        }
        return { outcome: 'crawled' };
    }
    /**
     * A page unchanged since the previous crawl: create a new snapshot marked
     * carried_forward that inherits the prior artifacts/score, and copy its issues
     * so history and diffs stay complete without re-fetching or re-validating.
     */
    async carryForward(data) {
        const previous = data.previous;
        if (!previous)
            return { outcome: 'unchanged' };
        const prior = await this.snapshots.findByCrawlAndPage(previous.crawlId, data.pageId);
        const { id } = await this.snapshots.replaceSnapshot({
            crawlId: data.crawlId,
            pageId: data.pageId,
            websiteId: data.websiteId,
            fetchStatus: 'carried_forward',
            httpStatus: prior?.httpStatus ?? 304,
            redirectChain: null,
            contentHash: previous.contentHash ? Buffer.from(previous.contentHash, 'hex') : null,
            artifacts: prior?.artifacts ?? null,
            score: prior?.score != null ? Number(prior.score) : null,
            issueCounts: prior?.issueCounts ?? {},
            timingMs: null,
            rendered: prior?.rendered ?? false,
        }, []);
        if (prior) {
            const to = {
                crawlId: data.crawlId,
                snapshotId: id,
                pageId: data.pageId,
                websiteId: data.websiteId,
            };
            await this.snapshots.copyIssues(previous.crawlId, prior.id, to);
            await this.schemaEntities.copyForCarryForward(previous.crawlId, prior.id, to);
        }
        return { outcome: 'unchanged' };
    }
    async persistFetchError(data, result) {
        await this.snapshots.replaceSnapshot({
            crawlId: data.crawlId,
            pageId: data.pageId,
            websiteId: data.websiteId,
            fetchStatus: 'error',
            httpStatus: result.status || null,
            redirectChain: result.redirectChain.length > 0 ? result.redirectChain : null,
            contentHash: null,
            artifacts: null,
            score: 0,
            issueCounts: { critical: 1 },
            timingMs: { fetch: result.timings.totalMs },
            rendered: false,
        }, [
            {
                checkId: result.status >= 400 ? seo_engine_1.CHECK_IDS.STATUS_ERROR : seo_engine_1.CHECK_IDS.FETCH_FAILED,
                severity: shared_1.IssueSeverity.Critical,
                fingerprint: (0, node_crypto_1.createHash)('sha256').update(`${data.pageId}:fetch-error`).digest(),
                evidence: {
                    status: result.status,
                    error: result.error?.code ?? null,
                    message: result.error?.message ?? null,
                },
            },
        ]);
        return { outcome: 'failed' };
    }
    /** Records progress and, when the crawl's pages have all settled, triggers finalize. */
    async finishPage(data, outcome) {
        const counters = await this.state.recordPage(data.crawlId, outcome, data.url);
        await this.state.publish(this.state.buildProgress(data.crawlId, shared_1.CrawlStatus.Running, counters));
        if (this.state.isComplete(counters)) {
            await this.crawls.updateStats(data.crawlId, {
                total: counters.total,
                crawled: counters.crawled,
                unchanged: counters.unchanged,
                failed: counters.failed,
            });
            await this.producer.enqueueFinalize({ crawlId: data.crawlId, reason: 'completed' });
        }
    }
    async enqueueLinkTargets(data, artifacts) {
        // Image sources are verified alongside anchor hrefs — otherwise a broken
        // <img> is undetectable and images.src.broken can never fire. Skip empty
        // srcs (an image with neither src nor a lazy-load attribute) so we never
        // enqueue an empty target and report it as a broken image.
        const imageSrcs = artifacts.images.map((i) => i.src).filter((src) => src.length > 0);
        const targets = [...new Set([...artifacts.links.map((l) => l.href), ...imageSrcs])];
        const fresh = await this.state.markLinkTargetsNew(data.crawlId, targets);
        const BATCH = 100;
        const batches = [];
        for (let i = 0; i < fresh.length; i += BATCH)
            batches.push(fresh.slice(i, i + BATCH));
        if (batches.length > 0) {
            // Track outstanding batches so finalize waits for link verification to drain.
            await this.state.incrLinkBatches(data.crawlId, batches.length);
            for (const urls of batches) {
                await this.producer.enqueueLinkCheck({
                    crawlId: data.crawlId,
                    websiteId: data.websiteId,
                    urls,
                });
            }
        }
    }
    async expandDiscovery(data, config, artifacts) {
        if (data.depth >= config.discoveryMaxDepth)
            return;
        const website = originOf(data.url);
        const filter = new crawler_core_1.UrlFilter({
            origin: website,
            pathScope: '/',
            allow: config.allow,
            block: config.block,
        });
        const internal = artifacts.links.filter((l) => l.internal && filter.classify(l.href) === 'in_scope');
        const newJobs = [];
        for (const link of internal) {
            const normalized = (0, crawler_core_1.normalizeUrl)(link.href);
            if (!normalized)
                continue;
            const hashHex = (0, crawler_core_1.urlHash)(normalized).toString('hex');
            if (!(await this.state.markSeen(data.crawlId, hashHex)))
                continue;
            const page = await this.pages.upsertOne(data.websiteId, normalized, (0, crawler_core_1.urlHash)(normalized));
            newJobs.push({
                crawlId: data.crawlId,
                websiteId: data.websiteId,
                pageId: page.id,
                url: normalized,
                depth: data.depth + 1,
                discover: true,
            });
        }
        if (newJobs.length > 0) {
            await this.state.addToTotal(data.crawlId, newJobs.length);
            await this.producer.enqueuePageFetch(newJobs, 5);
        }
    }
    async gatePoliteness(url, config) {
        const domain = registrableDomainOf(url);
        const { allowed, retryInMs } = await this.politeness.acquire(domain, config.ratePerSec);
        if (!allowed)
            throw new RateLimitedError(retryInMs);
    }
    async shouldSkip(crawlId) {
        if (await this.state.isCancelled(crawlId))
            return true;
        if (await this.state.isPaused(crawlId))
            throw new RateLimitedError(2000);
        return false;
    }
    async loadConfig(data) {
        const raw = await this.state.getConfig(data.crawlId);
        const fallback = (0, crawl_config_1.resolveCrawlConfig)({}, {
            userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
            ratePerSec: this.config.get('DEFAULT_DOMAIN_RATE_PER_SEC', { infer: true }),
            domainConcurrency: this.config.get('DEFAULT_DOMAIN_CONCURRENCY', { infer: true }),
        });
        return (0, crawl_config_1.deserializeConfig)(raw, fallback);
    }
    /** Heuristic: server-rendered pages expose content; near-empty body root ⇒ needs JS. */
    needsRender(html) {
        const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
        const body = bodyMatch?.[1] ?? html;
        const text = body
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .trim();
        const hasAppRoot = /<div[^>]+id=["'](root|app|__next)["']/i.test(html);
        return hasAppRoot && text.length < 200;
    }
    toIssues(results) {
        return results.map((r) => ({
            checkId: r.ruleId,
            severity: r.severity,
            fingerprint: (0, node_crypto_1.createHash)('sha256')
                .update(`${r.ruleId}:${r.affectedElement ?? ''}:${r.message}`)
                .digest(),
            evidence: {
                message: r.message,
                technicalExplanation: r.technicalExplanation,
                suggestedFix: r.suggestedFix,
                affectedElement: r.affectedElement ?? null,
                weight: (0, seo_engine_1.getCheck)(r.ruleId)?.weight ?? null,
                ...r.metadata,
            },
        }));
    }
    /** Maps schema-engine output to persistable entity rows (one per top-level entity). */
    toSchemaEntities(schema) {
        return schema.entities.map((entity, i) => {
            const validation = schema.validations[i];
            const rich = schema.richResults[i];
            return {
                format: entity.format,
                schemaType: entity.type || 'Unknown',
                status: validation?.status ?? 'valid',
                identity: entity.identity,
                properties: entity.properties,
                validation: validation
                    ? {
                        results: validation.results,
                        missingRequired: validation.missingRequired,
                        missingRecommended: validation.missingRecommended,
                        invalidProperties: validation.invalidProperties,
                        deprecatedProperties: validation.deprecatedProperties,
                        requiredProperties: validation.requiredProperties,
                        recommendedProperties: validation.recommendedProperties,
                        detectedProperties: validation.detectedProperties,
                    }
                    : {},
                richResults: rich?.verdicts ?? [],
                entityHash: Buffer.from(entity.entityHash, 'hex'),
                confidence: validation?.confidence ?? 1,
            };
        });
    }
};
exports.PageProcessorService = PageProcessorService;
exports.PageProcessorService = PageProcessorService = PageProcessorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.CrawlsRepository,
        db_1.PagesRepository,
        db_1.PageSnapshotsRepository,
        db_1.SchemaEntitiesRepository,
        crawl_producer_service_1.CrawlProducerService,
        fetcher_factory_1.FetcherFactory,
        html_storage_service_1.HtmlStorageService,
        politeness_service_1.PolitenessService,
        crawl_state_service_1.CrawlStateService,
        config_1.ConfigService])
], PageProcessorService);
function originOf(url) {
    try {
        return new URL(url).origin;
    }
    catch {
        return url;
    }
}
function registrableDomainOf(url) {
    try {
        const host = new URL(url).host;
        return host.replace(/^www\./, '');
    }
    catch {
        return 'unknown';
    }
}
function countBySeverity(results) {
    const counts = {};
    for (const r of results)
        counts[r.severity] = (counts[r.severity] ?? 0) + 1;
    return counts;
}
/** Compact per-page schema rollup stored on the snapshot artifacts for fast reads. */
function schemaSummary(schema) {
    return {
        entityCount: schema.coverage.entityCount,
        types: Object.keys(schema.coverage.typeCounts),
        richEligible: schema.coverage.richEligibleCount,
        errors: schema.coverage.errorCount,
        warnings: schema.coverage.warningCount,
        invalidJson: schema.coverage.invalidJsonCount,
    };
}
//# sourceMappingURL=page-processor.service.js.map