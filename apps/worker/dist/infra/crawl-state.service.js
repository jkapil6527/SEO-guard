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
exports.CrawlStateService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
const ioredis_1 = require("ioredis");
const redis_provider_1 = require("./redis.provider");
const TTL_SECONDS = 3 * 24 * 3600;
/**
 * Live crawl state in Redis: atomic counters, dedupe sets, pause/cancel flags,
 * and progress publication. Counters are the fast path (workers increment on
 * every page); PostgreSQL is flushed periodically by the finalizer/orchestrator.
 */
let CrawlStateService = class CrawlStateService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async init(crawlId, total, config) {
        const keys = (0, shared_1.crawlKeys)(crawlId);
        const pipeline = this.redis.multi();
        pipeline.hset(keys.counters, {
            total,
            crawled: 0,
            unchanged: 0,
            failed: 0,
            startedAtMs: Date.now(),
            currentUrl: '',
        });
        pipeline.expire(keys.counters, TTL_SECONDS);
        if (Object.keys(config).length > 0) {
            pipeline.hset(keys.config, config);
            pipeline.expire(keys.config, TTL_SECONDS);
        }
        await pipeline.exec();
    }
    async addToTotal(crawlId, delta) {
        const keys = (0, shared_1.crawlKeys)(crawlId);
        await this.redis.hincrby(keys.counters, 'total', delta);
    }
    async getConfig(crawlId) {
        return this.redis.hgetall((0, shared_1.crawlKeys)(crawlId).config);
    }
    /** Marks progress on one page and returns fresh counters for publication. */
    async recordPage(crawlId, outcome, currentUrl) {
        const keys = (0, shared_1.crawlKeys)(crawlId);
        const pipeline = this.redis.multi();
        pipeline.hincrby(keys.counters, outcome, 1);
        pipeline.hset(keys.counters, 'currentUrl', currentUrl);
        pipeline.hgetall(keys.counters);
        const res = await pipeline.exec();
        const raw = (res?.[2]?.[1] ?? {});
        return this.parseCounters(raw);
    }
    async getCounters(crawlId) {
        const raw = await this.redis.hgetall((0, shared_1.crawlKeys)(crawlId).counters);
        return this.parseCounters(raw);
    }
    /** True once every page has reached a terminal outcome. */
    isComplete(c) {
        return c.total > 0 && c.crawled + c.unchanged + c.failed >= c.total;
    }
    /** Discovery dedupe: returns true if the url hash was newly added. */
    async markSeen(crawlId, urlHashHex) {
        const keys = (0, shared_1.crawlKeys)(crawlId);
        const added = await this.redis.sadd(keys.seen, urlHashHex);
        if (added === 1)
            await this.redis.expire(keys.seen, TTL_SECONDS);
        return added === 1;
    }
    async markLinkTargetsNew(crawlId, urls) {
        if (urls.length === 0)
            return [];
        const keys = (0, shared_1.crawlKeys)(crawlId);
        const pipeline = this.redis.multi();
        urls.forEach((u) => pipeline.sadd(keys.linkTargets, u));
        pipeline.expire(keys.linkTargets, TTL_SECONDS);
        const res = await pipeline.exec();
        return urls.filter((_, i) => res?.[i]?.[1] === 1);
    }
    /** Outstanding link-check batches; finalize waits until this reaches zero. */
    async incrLinkBatches(crawlId, delta) {
        const key = `${(0, shared_1.crawlKeys)(crawlId).counters}:linkbatches`;
        await this.redis.incrby(key, delta);
        await this.redis.expire(key, TTL_SECONDS);
    }
    async decrLinkBatches(crawlId) {
        const key = `${(0, shared_1.crawlKeys)(crawlId).counters}:linkbatches`;
        return this.redis.decr(key);
    }
    async getLinkBatches(crawlId) {
        const key = `${(0, shared_1.crawlKeys)(crawlId).counters}:linkbatches`;
        const v = await this.redis.get(key);
        return v ? Number(v) : 0;
    }
    async requestCancel(crawlId) {
        await this.redis.set((0, shared_1.crawlKeys)(crawlId).cancelled, '1', 'EX', TTL_SECONDS);
    }
    isCancelled(crawlId) {
        return this.redis.exists((0, shared_1.crawlKeys)(crawlId).cancelled).then((n) => n === 1);
    }
    async setPaused(crawlId, paused) {
        const key = (0, shared_1.crawlKeys)(crawlId).paused;
        if (paused)
            await this.redis.set(key, '1', 'EX', TTL_SECONDS);
        else
            await this.redis.del(key);
    }
    isPaused(crawlId) {
        return this.redis.exists((0, shared_1.crawlKeys)(crawlId).paused).then((n) => n === 1);
    }
    async publish(event) {
        await this.redis.publish((0, shared_1.crawlKeys)(event.crawlId).channel, JSON.stringify(event));
    }
    async cleanup(crawlId) {
        const keys = (0, shared_1.crawlKeys)(crawlId);
        await this.redis.del(keys.seen, keys.linkTargets, keys.config);
        // counters + flags kept briefly (their own TTL) so a late SSE client can read final state.
    }
    buildProgress(crawlId, status, c) {
        const done = c.crawled + c.unchanged + c.failed;
        const percent = c.total > 0 ? Math.min(100, Math.round((done / c.total) * 100)) : 0;
        let etaMs;
        const elapsed = Date.now() - c.startedAtMs;
        if (done > 0 && done < c.total && elapsed > 0) {
            etaMs = Math.round((elapsed / done) * (c.total - done));
        }
        return {
            crawlId,
            status,
            total: c.total,
            crawled: c.crawled,
            unchanged: c.unchanged,
            failed: c.failed,
            queued: Math.max(0, c.total - done),
            percent,
            currentUrl: c.currentUrl || undefined,
            etaMs,
        };
    }
    parseCounters(raw) {
        return {
            total: Number(raw.total ?? 0),
            crawled: Number(raw.crawled ?? 0),
            unchanged: Number(raw.unchanged ?? 0),
            failed: Number(raw.failed ?? 0),
            startedAtMs: Number(raw.startedAtMs ?? Date.now()),
            currentUrl: raw.currentUrl ?? '',
        };
    }
};
exports.CrawlStateService = CrawlStateService;
exports.CrawlStateService = CrawlStateService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_provider_1.REDIS)),
    __metadata("design:paramtypes", [ioredis_1.Redis])
], CrawlStateService);
//# sourceMappingURL=crawl-state.service.js.map