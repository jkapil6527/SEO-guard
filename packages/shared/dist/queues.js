"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_JOB_OPTIONS = exports.domainRateKey = exports.crawlKeys = exports.MAINTENANCE_JOBS = exports.QUEUES = void 0;
/**
 * Central queue registry. Names are stable identifiers shared by producers (api)
 * and consumers (worker); renaming a queue orphans its jobs, so treat these as a contract.
 */
exports.QUEUES = {
    /** Resolves a crawl's URL set from all sources and fans out page jobs. */
    CRAWL_ORCHESTRATE: 'crawl-orchestrate',
    /** Fetch + parse + validate + persist one page (static HTTP path). */
    PAGE_FETCH: 'page-fetch',
    /** Playwright rendering for JS-required pages; memory-heavy, scaled separately. */
    PAGE_RENDER: 'page-render',
    /** Verifies unique outbound link targets discovered during a crawl. */
    LINK_CHECK: 'link-check',
    /** Cross-page analysis, scoring, aggregates when a crawl's pages settle. */
    CRAWL_FINALIZE: 'crawl-finalize',
    /** Fires on schedule (BullMQ job schedulers); enqueues crawl orchestration. */
    SCHEDULE_FIRE: 'schedule-fire',
    /** Housekeeping: partition creation, schedule reconciliation, retention. */
    MAINTENANCE: 'maintenance',
};
exports.MAINTENANCE_JOBS = {
    ENSURE_PARTITIONS: 'ensure-partitions',
    RECONCILE_SCHEDULES: 'reconcile-schedules',
    /** Re-drive crawls left stuck in 'finalizing'/'running' by an interrupted finalize. */
    REAP_STUCK_CRAWLS: 'reap-stuck-crawls',
};
/** Redis key conventions for live crawl state. All keys expire with the crawl. */
const crawlKeys = (crawlId) => ({
    /** HSET total/crawled/unchanged/failed + startedAtMs + currentUrl. */
    counters: `crawl:${crawlId}:counters`,
    /** SET of url hashes already enqueued (discovery dedupe). */
    seen: `crawl:${crawlId}:seen`,
    /** SET of link-target URLs already queued for checking. */
    linkTargets: `crawl:${crawlId}:linktargets`,
    /** String flag: '1' when cancellation requested. */
    cancelled: `crawl:${crawlId}:cancelled`,
    /** String flag: '1' while paused. */
    paused: `crawl:${crawlId}:paused`,
    /** HSET of crawl config (renderPolicy, discovery limits, politeness). */
    config: `crawl:${crawlId}:config`,
    /** Pub/sub channel carrying CrawlProgressEvent JSON. */
    channel: `crawl:${crawlId}:events`,
});
exports.crawlKeys = crawlKeys;
/** Per-domain politeness bucket (fixed window). */
const domainRateKey = (domain) => `rate:domain:${domain}`;
exports.domainRateKey = domainRateKey;
/** Default job options applied by producers. */
exports.DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 24 * 3600, count: 10_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
};
//# sourceMappingURL=queues.js.map