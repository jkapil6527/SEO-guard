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
exports.PageRenderProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const shared_1 = require("@seo-guardian/shared");
const bullmq_2 = require("bullmq");
const crawl_config_1 = require("../crawl/crawl-config");
const browser_pool_service_1 = require("../crawl/browser-pool.service");
const fetcher_factory_1 = require("../crawl/fetcher.factory");
const page_processor_service_1 = require("../crawl/page-processor.service");
const crawl_state_service_1 = require("../infra/crawl-state.service");
/**
 * JavaScript render path. Re-fetches through the SSRF-guarded fetcher (to
 * validate the target and capture headers/redirects), renders the validated
 * final URL with Playwright, then runs the same validate-and-persist path.
 * Falls back to the static body when rendering fails.
 */
let PageRenderProcessor = class PageRenderProcessor extends bullmq_1.WorkerHost {
    pageProcessor;
    fetcherFactory;
    browserPool;
    state;
    config;
    constructor(pageProcessor, fetcherFactory, browserPool, state, config) {
        super();
        this.pageProcessor = pageProcessor;
        this.fetcherFactory = fetcherFactory;
        this.browserPool = browserPool;
        this.state = state;
        this.config = config;
    }
    async process(job, token) {
        const data = job.data;
        try {
            if (await this.state.isCancelled(data.crawlId))
                return { skipped: true };
            const crawlConfig = (0, crawl_config_1.deserializeConfig)(await this.state.getConfig(data.crawlId), (0, crawl_config_1.resolveCrawlConfig)({}, {
                userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
                ratePerSec: this.config.get('DEFAULT_DOMAIN_RATE_PER_SEC', { infer: true }),
                domainConcurrency: this.config.get('DEFAULT_DOMAIN_CONCURRENCY', { infer: true }),
            }));
            const fetcher = this.fetcherFactory.create(crawlConfig);
            const result = await fetcher.fetch(data.url);
            if (result.error || !result.body) {
                const outcome = await this.pageProcessor.processRendered(data, '', result);
                await this.pageProcessor.finishPage(data, outcome.outcome);
                return outcome;
            }
            const rendered = await this.browserPool.render(result.finalUrl, crawlConfig.userAgent, crawlConfig.timeoutMs);
            const html = rendered ?? result.body.toString('utf8');
            const outcome = await this.pageProcessor.processRendered(data, html, result);
            await this.pageProcessor.finishPage(data, outcome.outcome);
            return { ...outcome, rendered: rendered !== null };
        }
        catch (err) {
            if (err instanceof page_processor_service_1.RateLimitedError) {
                await job.moveToDelayed(Date.now() + err.retryInMs, token);
                throw new bullmq_2.DelayedError();
            }
            throw err;
        }
    }
};
exports.PageRenderProcessor = PageRenderProcessor;
exports.PageRenderProcessor = PageRenderProcessor = __decorate([
    (0, bullmq_1.Processor)(shared_1.QUEUES.PAGE_RENDER, {
        concurrency: Number(process.env.RENDER_CONCURRENCY ?? 2),
    }),
    __metadata("design:paramtypes", [page_processor_service_1.PageProcessorService,
        fetcher_factory_1.FetcherFactory,
        browser_pool_service_1.BrowserPoolService,
        crawl_state_service_1.CrawlStateService,
        config_1.ConfigService])
], PageRenderProcessor);
//# sourceMappingURL=page-render.processor.js.map