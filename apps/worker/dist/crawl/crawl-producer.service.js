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
exports.CrawlProducerService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
/**
 * Single writer for all crawl-related queues. Page jobs carry a per-domain
 * group key so BullMQ's group concurrency enforces politeness independently of
 * worker count (docs/05 §1).
 */
let CrawlProducerService = class CrawlProducerService {
    orchestrateQueue;
    fetchQueue;
    renderQueue;
    linkQueue;
    finalizeQueue;
    constructor(orchestrateQueue, fetchQueue, renderQueue, linkQueue, finalizeQueue) {
        this.orchestrateQueue = orchestrateQueue;
        this.fetchQueue = fetchQueue;
        this.renderQueue = renderQueue;
        this.linkQueue = linkQueue;
        this.finalizeQueue = finalizeQueue;
    }
    enqueueOrchestrate(data, priority) {
        return this.orchestrateQueue.add('orchestrate', data, { ...shared_1.DEFAULT_JOB_OPTIONS, priority });
    }
    async enqueuePageFetch(jobs, priority) {
        if (jobs.length === 0)
            return;
        // Per-domain politeness is enforced at processing time by PolitenessService
        // (Redis rate limiter + delay-retry), which holds regardless of worker count.
        await this.fetchQueue.addBulk(jobs.map((data) => ({
            name: 'fetch',
            data,
            opts: { ...shared_1.DEFAULT_JOB_OPTIONS, priority, jobId: `${data.crawlId}_${data.pageId}` },
        })));
    }
    enqueueRender(data, priority) {
        return this.renderQueue.add('render', data, {
            ...shared_1.DEFAULT_JOB_OPTIONS,
            priority,
            jobId: `render_${data.crawlId}_${data.pageId}`,
        });
    }
    enqueueLinkCheck(data) {
        return this.linkQueue.add('link-check', data, { ...shared_1.DEFAULT_JOB_OPTIONS, priority: 10 });
    }
    enqueueFinalize(data) {
        return this.finalizeQueue.add('finalize', data, {
            ...shared_1.DEFAULT_JOB_OPTIONS,
            priority: 1,
            jobId: `finalize_${data.crawlId}`,
            // Collapse repeated completion signals into a single finalize.
            deduplication: { id: `finalize_${data.crawlId}` },
        });
    }
    /**
     * Re-drive finalize for a stuck crawl. The fixed jobId + deduplication that
     * collapse duplicate completion signals also mean a *failed* finalize job
     * lingers under that id and silently blocks any re-enqueue — so a crawl whose
     * finalize died (e.g. the worker was interrupted mid-run) can never recover on
     * its own. Clear the stale job and its dedup key first, then enqueue fresh.
     * Genuinely in-flight jobs (waiting/active/delayed) are left untouched.
     *
     * Returns true if a fresh finalize was enqueued.
     */
    async redriveFinalize(crawlId) {
        const jobId = `finalize_${crawlId}`;
        const existing = await this.finalizeQueue.getJob(jobId);
        if (existing) {
            const state = await existing.getState();
            if (state === 'active' || state === 'waiting' || state === 'delayed') {
                return false;
            }
            await existing.remove();
        }
        await this.finalizeQueue.removeDeduplicationKey(jobId);
        await this.enqueueFinalize({ crawlId, reason: 'watchdog' });
        return true;
    }
};
exports.CrawlProducerService = CrawlProducerService;
exports.CrawlProducerService = CrawlProducerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.CRAWL_ORCHESTRATE)),
    __param(1, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.PAGE_FETCH)),
    __param(2, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.PAGE_RENDER)),
    __param(3, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.LINK_CHECK)),
    __param(4, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.CRAWL_FINALIZE)),
    __metadata("design:paramtypes", [Function, Function, Function, Function, Function])
], CrawlProducerService);
//# sourceMappingURL=crawl-producer.service.js.map