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
var OrchestrateProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrateProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const db_1 = require("@seo-guardian/db");
const crawler_core_1 = require("@seo-guardian/crawler-core");
const seo_engine_1 = require("@seo-guardian/seo-engine");
const shared_1 = require("@seo-guardian/shared");
const crawl_config_1 = require("../crawl/crawl-config");
const crawl_producer_service_1 = require("../crawl/crawl-producer.service");
const fetcher_factory_1 = require("../crawl/fetcher.factory");
const url_resolver_service_1 = require("../crawl/url-resolver.service");
const crawl_state_service_1 = require("../infra/crawl-state.service");
/**
 * Resolves a crawl's URL set from its sources, registers pages, seeds live
 * state, and fans out one page-fetch job per URL. Incremental crawls attach
 * conditional-request hints from the previous completed crawl.
 */
let OrchestrateProcessor = OrchestrateProcessor_1 = class OrchestrateProcessor extends bullmq_1.WorkerHost {
    crawls;
    websites;
    pages;
    snapshots;
    groups;
    resolver;
    fetcherFactory;
    producer;
    state;
    config;
    logger = new common_1.Logger(OrchestrateProcessor_1.name);
    constructor(crawls, websites, pages, snapshots, groups, resolver, fetcherFactory, producer, state, config) {
        super();
        this.crawls = crawls;
        this.websites = websites;
        this.pages = pages;
        this.snapshots = snapshots;
        this.groups = groups;
        this.resolver = resolver;
        this.fetcherFactory = fetcherFactory;
        this.producer = producer;
        this.state = state;
        this.config = config;
    }
    async process(job) {
        const { crawlId } = job.data;
        const crawl = await this.crawls.findById(crawlId);
        if (!crawl) {
            this.logger.warn(`crawl ${crawlId} vanished before orchestration`);
            return { resolved: 0 };
        }
        if (await this.state.isCancelled(crawlId)) {
            await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Cancelled);
            return { cancelled: true };
        }
        const website = await this.websites.findById(crawl.websiteId);
        if (!website) {
            await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Failed, { error: 'website deleted' });
            return { failed: true };
        }
        await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Resolving);
        const crawlConfig = (0, crawl_config_1.resolveCrawlConfig)(website.settings, {
            userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
            ratePerSec: this.config.get('DEFAULT_DOMAIN_RATE_PER_SEC', { infer: true }),
            domainConcurrency: this.config.get('DEFAULT_DOMAIN_CONCURRENCY', { infer: true }),
        });
        let seeds;
        if (crawl.scope === shared_1.CrawlScope.Page) {
            // Page scope: the crawl's single target, and nothing else. Discovery is
            // off, so link extraction never expands the frontier.
            const target = crawl.targetUrl ? (0, crawler_core_1.normalizeUrl)(crawl.targetUrl) : null;
            if (!target) {
                await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Failed, {
                    error: `Single-page crawl has no valid target URL (${crawl.targetUrl ?? 'none'}).`,
                });
                await this.state.init(crawlId, 0, (0, crawl_config_1.serializeConfig)(crawlConfig));
                return { resolved: 0 };
            }
            seeds = [{ url: target, allowDiscovery: false }];
            this.logger.log(`crawl ${crawlId}: single-page crawl of ${target}`);
        }
        else if (crawl.scope === shared_1.CrawlScope.Group) {
            // Category scope: exactly the URLs of this group's sitemap. No discovery,
            // no other sources of the website.
            const group = crawl.sitemapGroupId
                ? await this.groups.findById(crawl.sitemapGroupId)
                : null;
            if (!group?.sitemapUrl) {
                await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Failed, {
                    error: 'This category has no sitemap URL. Add one before crawling it.',
                });
                await this.state.init(crawlId, 0, (0, crawl_config_1.serializeConfig)(crawlConfig));
                return { resolved: 0 };
            }
            const fetcher = this.fetcherFactory.create(crawlConfig);
            const maxUrls = Number(group.settings?.maxUrls) || undefined;
            seeds = await this.resolver.resolveSitemap(group.sitemapUrl, crawlConfig, fetcher, maxUrls);
            if (seeds.length === 0) {
                await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Completed, {
                    error: `The sitemap ${group.sitemapUrl} returned no URLs.`,
                });
                await this.state.init(crawlId, 0, (0, crawl_config_1.serializeConfig)(crawlConfig));
                return { resolved: 0 };
            }
            this.logger.log(`crawl ${crawlId}: category "${group.name}" — ${seeds.length} URLs from ${group.sitemapUrl}`);
        }
        else {
            const fetcher = this.fetcherFactory.create(crawlConfig);
            seeds = await this.resolver.resolve(crawl.websiteId, crawlConfig, fetcher);
            // Domain-crawl fallback: with no resolvable sources, crawl the website's
            // homepage and discover its internal links (bounded by depth/page limits).
            // This makes "add a website → start crawl" work without a sitemap.
            if (seeds.length === 0) {
                const origin = (0, crawler_core_1.normalizeUrl)(website.origin);
                if (origin) {
                    seeds = [{ url: origin, allowDiscovery: true }];
                    this.logger.log(`crawl ${crawlId}: no sources resolved; domain crawl from ${origin}`);
                }
            }
            if (seeds.length === 0) {
                await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Completed, {
                    error: 'No URLs to crawl. Add a sitemap or URL list under Sources, or check the origin.',
                });
                await this.state.init(crawlId, 0, (0, crawl_config_1.serializeConfig)(crawlConfig));
                return { resolved: 0 };
            }
        }
        // Register pages (bulk upsert), then map normalized URL → page id.
        const pageRefs = await this.pages.upsertMany(crawl.websiteId, seeds.map((s) => ({ url: s.url, urlHash: (0, crawler_core_1.urlHash)(s.url) })));
        const pageIdByUrl = new Map(pageRefs.map((p) => [p.url, p.id]));
        // Record which pages belong to this category, carrying the sitemap's lastmod.
        // Membership is many-to-many: the same URL may appear in several sitemaps.
        if (crawl.sitemapGroupId) {
            await this.groups.linkPages(crawl.sitemapGroupId, seeds
                .map((s) => ({ pageId: pageIdByUrl.get(s.url), lastmod: s.lastmod ?? null }))
                .filter((p) => !!p.pageId));
        }
        // Incremental baseline: conditional hints from the previous completed crawl.
        const hintsByPage = new Map();
        if (crawl.mode === 'incremental') {
            const previous = await this.crawls.findPreviousCompleted(crawl.websiteId, crawlId, crawl.sitemapGroupId);
            if (previous) {
                for (const h of await this.snapshots.loadConditionalHints(previous.id)) {
                    hintsByPage.set(h.pageId, {
                        crawlId: previous.id,
                        snapshotId: h.snapshotId,
                        etag: h.etag ?? undefined,
                        lastModified: h.lastModified ?? undefined,
                        contentHash: h.contentHash ? h.contentHash.toString('hex') : undefined,
                    });
                }
            }
        }
        await this.state.init(crawlId, seeds.length, (0, crawl_config_1.serializeConfig)(crawlConfig));
        await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Running);
        await this.crawls.updateStats(crawlId, {
            total: seeds.length,
            crawled: 0,
            unchanged: 0,
            failed: 0,
        });
        const priority = crawl.trigger === 'scheduled' ? 20 : 5;
        const jobs = [];
        for (const seed of seeds) {
            const pageId = pageIdByUrl.get(seed.url);
            if (!pageId)
                continue;
            await this.state.markSeen(crawlId, (0, crawler_core_1.urlHash)(seed.url).toString('hex'));
            jobs.push({
                crawlId,
                websiteId: crawl.websiteId,
                pageId,
                url: seed.url,
                depth: 0,
                discover: seed.allowDiscovery,
                previous: hintsByPage.get(pageId),
            });
        }
        await this.producer.enqueuePageFetch(jobs, priority);
        this.logger.log(`crawl ${crawlId} orchestrated: ${jobs.length} pages, mode=${crawl.mode}, engine=${seo_engine_1.ENGINE_VERSION}`);
        return { resolved: jobs.length };
    }
};
exports.OrchestrateProcessor = OrchestrateProcessor;
exports.OrchestrateProcessor = OrchestrateProcessor = OrchestrateProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(shared_1.QUEUES.CRAWL_ORCHESTRATE, { concurrency: 4 }),
    __metadata("design:paramtypes", [db_1.CrawlsRepository,
        db_1.WebsitesRepository,
        db_1.PagesRepository,
        db_1.PageSnapshotsRepository,
        db_1.SitemapGroupsRepository,
        url_resolver_service_1.UrlResolverService,
        fetcher_factory_1.FetcherFactory,
        crawl_producer_service_1.CrawlProducerService,
        crawl_state_service_1.CrawlStateService,
        config_1.ConfigService])
], OrchestrateProcessor);
//# sourceMappingURL=orchestrate.processor.js.map