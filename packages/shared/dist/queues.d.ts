/**
 * Central queue registry. Names are stable identifiers shared by producers (api)
 * and consumers (worker); renaming a queue orphans its jobs, so treat these as a contract.
 */
export declare const QUEUES: {
    /** Resolves a crawl's URL set from all sources and fans out page jobs. */
    readonly CRAWL_ORCHESTRATE: "crawl-orchestrate";
    /** Fetch + parse + validate + persist one page (static HTTP path). */
    readonly PAGE_FETCH: "page-fetch";
    /** Playwright rendering for JS-required pages; memory-heavy, scaled separately. */
    readonly PAGE_RENDER: "page-render";
    /** Verifies unique outbound link targets discovered during a crawl. */
    readonly LINK_CHECK: "link-check";
    /** Cross-page analysis, scoring, aggregates when a crawl's pages settle. */
    readonly CRAWL_FINALIZE: "crawl-finalize";
    /** Fires on schedule (BullMQ job schedulers); enqueues crawl orchestration. */
    readonly SCHEDULE_FIRE: "schedule-fire";
    /** Housekeeping: partition creation, schedule reconciliation, retention. */
    readonly MAINTENANCE: "maintenance";
};
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
export declare const MAINTENANCE_JOBS: {
    readonly ENSURE_PARTITIONS: "ensure-partitions";
    readonly RECONCILE_SCHEDULES: "reconcile-schedules";
    /** Re-drive crawls left stuck in 'finalizing'/'running' by an interrupted finalize. */
    readonly REAP_STUCK_CRAWLS: "reap-stuck-crawls";
};
export interface ScheduleFireJobData {
    scheduleId: string;
    websiteId: string;
}
export interface OrchestrateJobData {
    crawlId: string;
}
export interface PageFetchJobData {
    crawlId: string;
    websiteId: string;
    pageId: string;
    url: string;
    /** Discovery depth; 0 for source-listed URLs. */
    depth: number;
    /**
     * Whether this page participates in internal-link discovery. True for domain/
     * discovery crawls (spider from seeds); false for list sources (manual, CSV,
     * sitemap) so they crawl exactly the given URLs — e.g. a single specific page.
     */
    discover?: boolean;
    /** Conditional-request hints from the previous completed crawl (incremental mode). */
    previous?: {
        crawlId: string;
        snapshotId: string;
        etag?: string;
        lastModified?: string;
        contentHash?: string;
    };
}
export interface PageRenderJobData extends PageFetchJobData {
    /** Object-storage key of the raw (pre-render) HTML, when already fetched. */
    rawObjectKey?: string;
}
export interface LinkCheckJobData {
    crawlId: string;
    websiteId: string;
    urls: string[];
}
export interface FinalizeJobData {
    crawlId: string;
    reason: 'completed' | 'cancelled' | 'watchdog';
}
/** Published on the crawl's Redis channel and streamed to clients over SSE. */
export interface CrawlProgressEvent {
    crawlId: string;
    status: string;
    total: number;
    crawled: number;
    unchanged: number;
    failed: number;
    queued: number;
    /** 0–100, integer. */
    percent: number;
    currentUrl?: string;
    /** Milliseconds; present once enough samples exist to extrapolate. */
    etaMs?: number;
    finishedAt?: string;
}
/** Redis key conventions for live crawl state. All keys expire with the crawl. */
export declare const crawlKeys: (crawlId: string) => {
    /** HSET total/crawled/unchanged/failed + startedAtMs + currentUrl. */
    readonly counters: `crawl:${string}:counters`;
    /** SET of url hashes already enqueued (discovery dedupe). */
    readonly seen: `crawl:${string}:seen`;
    /** SET of link-target URLs already queued for checking. */
    readonly linkTargets: `crawl:${string}:linktargets`;
    /** String flag: '1' when cancellation requested. */
    readonly cancelled: `crawl:${string}:cancelled`;
    /** String flag: '1' while paused. */
    readonly paused: `crawl:${string}:paused`;
    /** HSET of crawl config (renderPolicy, discovery limits, politeness). */
    readonly config: `crawl:${string}:config`;
    /** Pub/sub channel carrying CrawlProgressEvent JSON. */
    readonly channel: `crawl:${string}:events`;
};
/** Per-domain politeness bucket (fixed window). */
export declare const domainRateKey: (domain: string) => string;
/** Default job options applied by producers. */
export declare const DEFAULT_JOB_OPTIONS: {
    attempts: number;
    backoff: {
        type: "exponential";
        delay: number;
    };
    removeOnComplete: {
        age: number;
        count: number;
    };
    removeOnFail: {
        age: number;
    };
};
