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
var CrawlProgressService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlProgressService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
const ioredis_1 = require("ioredis");
const rxjs_1 = require("rxjs");
const redis_provider_1 = require("./redis.provider");
/**
 * API-side live crawl state: reads counters/flags the workers maintain in
 * Redis, sets pause/cancel flags, and bridges the crawl's pub/sub channel to
 * an SSE stream.
 */
let CrawlProgressService = CrawlProgressService_1 = class CrawlProgressService {
    redis;
    subscriber;
    logger = new common_1.Logger(CrawlProgressService_1.name);
    constructor(redis, subscriber) {
        this.redis = redis;
        this.subscriber = subscriber;
    }
    async requestCancel(crawlId) {
        await this.redis.set((0, shared_1.crawlKeys)(crawlId).cancelled, '1', 'EX', 3 * 24 * 3600);
    }
    async setPaused(crawlId, paused) {
        const key = (0, shared_1.crawlKeys)(crawlId).paused;
        if (paused)
            await this.redis.set(key, '1', 'EX', 3 * 24 * 3600);
        else
            await this.redis.del(key);
    }
    async snapshot(crawlId) {
        const raw = await this.redis.hgetall((0, shared_1.crawlKeys)(crawlId).counters);
        if (!raw || Object.keys(raw).length === 0)
            return null;
        return this.build(crawlId, raw);
    }
    /** SSE stream: emits the current snapshot then every published update. */
    stream(crawlId) {
        return new rxjs_1.Observable((observer) => {
            const channel = (0, shared_1.crawlKeys)(crawlId).channel;
            const sub = this.subscriber.duplicate();
            void this.snapshot(crawlId).then((snap) => {
                if (snap)
                    observer.next(snap);
            });
            const onMessage = (ch, message) => {
                if (ch !== channel)
                    return;
                try {
                    const event = JSON.parse(message);
                    observer.next(event);
                    if (event.finishedAt)
                        observer.complete();
                }
                catch (err) {
                    this.logger.warn({ err }, 'bad progress message');
                }
            };
            sub.on('message', onMessage);
            void sub.subscribe(channel).catch((err) => observer.error(err));
            return () => {
                sub.off('message', onMessage);
                void sub.quit().catch(() => undefined);
            };
        });
    }
    async onModuleDestroy() {
        await Promise.allSettled([this.redis.quit(), this.subscriber.quit()]);
    }
    build(crawlId, raw) {
        const total = Number(raw.total ?? 0);
        const crawled = Number(raw.crawled ?? 0);
        const unchanged = Number(raw.unchanged ?? 0);
        const failed = Number(raw.failed ?? 0);
        const done = crawled + unchanged + failed;
        const startedAtMs = Number(raw.startedAtMs ?? Date.now());
        const elapsed = Date.now() - startedAtMs;
        const etaMs = done > 0 && done < total && elapsed > 0
            ? Math.round((elapsed / done) * (total - done))
            : undefined;
        return {
            crawlId,
            status: 'running',
            total,
            crawled,
            unchanged,
            failed,
            queued: Math.max(0, total - done),
            percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
            currentUrl: raw.currentUrl || undefined,
            etaMs,
        };
    }
};
exports.CrawlProgressService = CrawlProgressService;
exports.CrawlProgressService = CrawlProgressService = CrawlProgressService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_provider_1.CRAWL_REDIS)),
    __param(1, (0, common_1.Inject)(redis_provider_1.CRAWL_REDIS_SUB)),
    __metadata("design:paramtypes", [ioredis_1.Redis,
        ioredis_1.Redis])
], CrawlProgressService);
//# sourceMappingURL=crawl-progress.service.js.map