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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkCheckProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const db_1 = require("@seo-guardian/db");
const crawler_core_1 = require("@seo-guardian/crawler-core");
const shared_1 = require("@seo-guardian/shared");
const crawl_config_1 = require("../crawl/crawl-config");
const fetcher_factory_1 = require("../crawl/fetcher.factory");
const crawl_state_service_1 = require("../infra/crawl-state.service");
const politeness_service_1 = require("../infra/politeness.service");
/**
 * Verifies a batch of unique outbound link targets with HEAD (GET fallback),
 * subject to the same per-domain politeness. Results persist once per crawl and
 * are joined back into per-page broken-link issues by the finalizer.
 */
let LinkCheckProcessor = class LinkCheckProcessor extends bullmq_1.WorkerHost {
    linkChecks;
    websites;
    fetcherFactory;
    politeness;
    state;
    config;
    constructor(linkChecks, websites, fetcherFactory, politeness, state, config) {
        super();
        this.linkChecks = linkChecks;
        this.websites = websites;
        this.fetcherFactory = fetcherFactory;
        this.politeness = politeness;
        this.state = state;
        this.config = config;
    }
    async process(job) {
        const { crawlId, websiteId, urls } = job.data;
        const website = await this.websites.findById(websiteId);
        if (!website) {
            await this.state.decrLinkBatches(crawlId);
            return { checked: 0 };
        }
        const crawlConfig = (0, crawl_config_1.resolveCrawlConfig)(website.settings, {
            userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
            ratePerSec: this.config.get('DEFAULT_DOMAIN_RATE_PER_SEC', { infer: true }),
            domainConcurrency: this.config.get('DEFAULT_DOMAIN_CONCURRENCY', { infer: true }),
        });
        const fetcher = this.fetcherFactory.create(crawlConfig);
        const originDomain = safeDomain(website.origin);
        const results = [];
        for (const url of urls) {
            const domain = safeDomain(url);
            // Best-effort politeness; link checks are low priority and don't retry-loop.
            await this.politeness.acquire(domain, crawlConfig.ratePerSec).catch(() => undefined);
            let res = await fetcher.fetch(url, { method: 'HEAD' });
            // Some servers reject HEAD; retry with GET before declaring broken.
            if (res.status === 405 || res.status === 501 || (res.status === 0 && res.error)) {
                res = await fetcher.fetch(url, { method: 'GET' });
            }
            const ok = res.ok || (res.status >= 200 && res.status < 400);
            results.push({
                url,
                urlHash: (0, crawler_core_1.urlHash)(url),
                status: res.status || null,
                ok,
                isInternal: domain === originDomain,
                redirectHops: res.redirectChain.length,
                error: res.error?.code ?? null,
            });
        }
        await this.linkChecks.insertMany(crawlId, websiteId, results);
        await this.state.decrLinkBatches(crawlId);
        return { checked: results.length, broken: results.filter((r) => !r.ok).length };
    }
};
exports.LinkCheckProcessor = LinkCheckProcessor;
exports.LinkCheckProcessor = LinkCheckProcessor = __decorate([
    (0, bullmq_1.Processor)(shared_1.QUEUES.LINK_CHECK, {
        concurrency: Number(process.env.LINK_CHECK_CONCURRENCY ?? 6),
    }),
    __metadata("design:paramtypes", [db_1.LinkChecksRepository,
        db_1.WebsitesRepository,
        fetcher_factory_1.FetcherFactory,
        politeness_service_1.PolitenessService,
        crawl_state_service_1.CrawlStateService,
        config_1.ConfigService])
], LinkCheckProcessor);
function safeDomain(url) {
    try {
        return (0, crawler_core_1.registrableDomain)(new URL(url).host);
    }
    catch {
        return 'unknown';
    }
}
//# sourceMappingURL=link-check.processor.js.map