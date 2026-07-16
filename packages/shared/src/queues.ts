/**
 * Central queue registry. Names are stable identifiers shared by producers (api)
 * and consumers (worker); renaming a queue orphans its jobs, so treat these as a contract.
 */
export const QUEUES = {
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
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const MAINTENANCE_JOBS = {
  ENSURE_PARTITIONS: 'ensure-partitions',
  RECONCILE_SCHEDULES: 'reconcile-schedules',
  /** Re-drive crawls left stuck in 'finalizing'/'running' by an interrupted finalize. */
  REAP_STUCK_CRAWLS: 'reap-stuck-crawls',
} as const;

// ---------- job payloads ----------

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

// ---------- live progress ----------

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
export const crawlKeys = (crawlId: string) =>
  ({
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
  }) as const;

/** Per-domain politeness bucket (fixed window). */
export const domainRateKey = (domain: string) => `rate:domain:${domain}`;

/** Default job options applied by producers. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { age: 24 * 3600, count: 10_000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};
