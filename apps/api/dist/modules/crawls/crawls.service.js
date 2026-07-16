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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlsService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const seo_engine_1 = require("@seo-guardian/seo-engine");
const shared_1 = require("@seo-guardian/shared");
const audit_service_1 = require("../audit/audit.service");
const crawl_progress_service_1 = require("./crawl-progress.service");
const CONTROLLABLE = new Set([
    shared_1.CrawlStatus.Queued,
    shared_1.CrawlStatus.Resolving,
    shared_1.CrawlStatus.Running,
    shared_1.CrawlStatus.Paused,
]);
let CrawlsService = class CrawlsService {
    crawls;
    websites;
    snapshots;
    issues;
    progress;
    audit;
    orchestrateQueue;
    fetchQueue;
    constructor(crawls, websites, snapshots, issues, progress, audit, orchestrateQueue, fetchQueue) {
        this.crawls = crawls;
        this.websites = websites;
        this.snapshots = snapshots;
        this.issues = issues;
        this.progress = progress;
        this.audit = audit;
        this.orchestrateQueue = orchestrateQueue;
        this.fetchQueue = fetchQueue;
    }
    async start(websiteId, mode, scope, url, ctx, sitemapGroupId) {
        const website = await this.websites.findById(websiteId);
        if (!website) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'website not found' });
        }
        const targetUrl = scope === shared_1.CrawlScope.Page ? this.resolvePageTarget(url, website.origin) : null;
        if (scope === shared_1.CrawlScope.Group && !sitemapGroupId) {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                message: 'sitemapGroupId is required for a category crawl',
            });
        }
        // Categories are independent, so the guard is scoped to the group. A
        // website-wide crawl still conflicts with everything, since it covers them all.
        const active = await this.crawls.findActiveForScope(websiteId, sitemapGroupId);
        if (active) {
            throw new common_1.ConflictException({
                code: shared_1.ERROR_CODES.CONFLICT,
                message: active.sitemapGroupId
                    ? `A crawl is already ${active.status} for this category`
                    : `A site-wide crawl is already ${active.status} for this website`,
            });
        }
        const crawl = await this.crawls.create({
            websiteId,
            trigger: 'manual',
            mode,
            scope,
            targetUrl,
            sitemapGroupId: sitemapGroupId ?? null,
            rulePackVersion: seo_engine_1.ENGINE_VERSION,
            createdBy: ctx.actor.id,
        });
        await this.orchestrateQueue.add('orchestrate', { crawlId: crawl.id }, { ...shared_1.DEFAULT_JOB_OPTIONS, priority: 5 });
        await this.audit.record({
            ...ctx,
            projectId: website.projectId,
            action: 'start',
            entity: 'crawl',
            entityId: crawl.id,
            after: { mode, scope, targetUrl, sitemapGroupId: sitemapGroupId ?? null, trigger: 'manual' },
        });
        return crawl;
    }
    /**
     * A page crawl must stay inside the website it belongs to — otherwise the URL
     * is an arbitrary fetch target chosen by the caller. The worker canonicalizes
     * the URL later; here we only enforce http(s) and a matching origin.
     */
    resolvePageTarget(url, origin) {
        const reject = (message) => {
            throw new common_1.BadRequestException({
                code: shared_1.ERROR_CODES.VALIDATION_FAILED,
                message,
                errors: [{ field: 'url', message }],
            });
        };
        if (!url?.trim()) {
            return reject('Enter the page URL to crawl');
        }
        let parsed;
        try {
            parsed = new URL(url.trim());
        }
        catch {
            return reject('Enter a valid http(s) URL');
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return reject('Enter a valid http(s) URL');
        }
        if (parsed.origin !== new URL(origin).origin) {
            return reject(`The URL must be on this website's origin (${origin})`);
        }
        return parsed.toString();
    }
    listAll(limit, beforeCreatedAt, projectId) {
        return this.crawls.listAll(limit, beforeCreatedAt, projectId);
    }
    async getStatus(crawlId) {
        const crawl = await this.crawls.findReportById(crawlId);
        if (!crawl) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'crawl not found' });
        }
        const live = await this.progress.snapshot(crawlId);
        return { ...crawl, live };
    }
    history(websiteId, limit, beforeCreatedAt) {
        return this.crawls.listByWebsite(websiteId, limit, beforeCreatedAt);
    }
    async pause(crawlId, ctx) {
        const crawl = await this.assertControllable(crawlId);
        await this.progress.setPaused(crawlId, true);
        await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Paused);
        await this.recordControl(crawl, 'pause', ctx);
    }
    async resume(crawlId, ctx) {
        const crawl = await this.getById(crawlId);
        if (crawl.status !== shared_1.CrawlStatus.Paused) {
            throw new common_1.ConflictException({ code: shared_1.ERROR_CODES.CONFLICT, message: 'crawl is not paused' });
        }
        await this.progress.setPaused(crawlId, false);
        await this.crawls.setStatus(crawlId, shared_1.CrawlStatus.Running);
        await this.recordControl(crawl, 'resume', ctx);
    }
    async cancel(crawlId, ctx) {
        const crawl = await this.assertControllable(crawlId);
        await this.progress.requestCancel(crawlId);
        await this.progress.setPaused(crawlId, false);
        // Workers observe the flag and stop; a terminal status is set by them or the finalizer.
        await this.recordControl(crawl, 'cancel', ctx);
    }
    async retryFailed(crawlId, ctx) {
        const crawl = await this.getById(crawlId);
        const failed = await this.snapshots.listFailedPages(crawlId);
        if (failed.length === 0)
            return { requeued: 0 };
        await this.fetchQueue.addBulk(failed.map((f) => ({
            name: 'fetch',
            data: {
                crawlId,
                websiteId: crawl.websiteId,
                pageId: f.pageId,
                url: f.url,
                depth: 0,
            },
            opts: {
                ...shared_1.DEFAULT_JOB_OPTIONS,
                priority: 3,
                jobId: `retry_${crawlId}_${f.pageId}_${Date.now()}`,
            },
        })));
        await this.recordControl(crawl, 'retry-failed', ctx);
        return { requeued: failed.length };
    }
    async assertControllable(crawlId) {
        const crawl = await this.getById(crawlId);
        if (!CONTROLLABLE.has(crawl.status)) {
            throw new common_1.ConflictException({
                code: shared_1.ERROR_CODES.CONFLICT,
                message: `crawl is ${crawl.status} and cannot be controlled`,
            });
        }
        return crawl;
    }
    async getById(crawlId) {
        const crawl = await this.crawls.findById(crawlId);
        if (!crawl) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'crawl not found' });
        }
        return crawl;
    }
    async recordControl(crawl, action, ctx) {
        const projectId = await this.websites.projectIdOf(crawl.websiteId);
        await this.audit.record({
            ...ctx,
            projectId,
            action,
            entity: 'crawl',
            entityId: crawl.id,
        });
    }
};
exports.CrawlsService = CrawlsService;
exports.CrawlsService = CrawlsService = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.CRAWL_ORCHESTRATE)),
    __param(7, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.PAGE_FETCH)),
    __metadata("design:paramtypes", [db_1.CrawlsRepository,
        db_1.WebsitesRepository,
        db_1.PageSnapshotsRepository,
        db_1.PageIssuesRepository,
        crawl_progress_service_1.CrawlProgressService,
        audit_service_1.AuditService, Function, Function])
], CrawlsService);
//# sourceMappingURL=crawls.service.js.map