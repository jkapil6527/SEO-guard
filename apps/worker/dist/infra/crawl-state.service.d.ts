import type { CrawlProgressEvent } from '@seo-guardian/shared';
import { Redis } from 'ioredis';
export interface CrawlCounters {
    total: number;
    crawled: number;
    unchanged: number;
    failed: number;
    startedAtMs: number;
    currentUrl: string;
}
/**
 * Live crawl state in Redis: atomic counters, dedupe sets, pause/cancel flags,
 * and progress publication. Counters are the fast path (workers increment on
 * every page); PostgreSQL is flushed periodically by the finalizer/orchestrator.
 */
export declare class CrawlStateService {
    private readonly redis;
    constructor(redis: Redis);
    init(crawlId: string, total: number, config: Record<string, string>): Promise<void>;
    addToTotal(crawlId: string, delta: number): Promise<void>;
    getConfig(crawlId: string): Promise<Record<string, string>>;
    /** Marks progress on one page and returns fresh counters for publication. */
    recordPage(crawlId: string, outcome: 'crawled' | 'unchanged' | 'failed', currentUrl: string): Promise<CrawlCounters>;
    getCounters(crawlId: string): Promise<CrawlCounters>;
    /** True once every page has reached a terminal outcome. */
    isComplete(c: CrawlCounters): boolean;
    /** Discovery dedupe: returns true if the url hash was newly added. */
    markSeen(crawlId: string, urlHashHex: string): Promise<boolean>;
    markLinkTargetsNew(crawlId: string, urls: string[]): Promise<string[]>;
    /** Outstanding link-check batches; finalize waits until this reaches zero. */
    incrLinkBatches(crawlId: string, delta: number): Promise<void>;
    decrLinkBatches(crawlId: string): Promise<number>;
    getLinkBatches(crawlId: string): Promise<number>;
    requestCancel(crawlId: string): Promise<void>;
    isCancelled(crawlId: string): Promise<boolean>;
    setPaused(crawlId: string, paused: boolean): Promise<void>;
    isPaused(crawlId: string): Promise<boolean>;
    publish(event: CrawlProgressEvent): Promise<void>;
    cleanup(crawlId: string): Promise<void>;
    buildProgress(crawlId: string, status: string, c: CrawlCounters): CrawlProgressEvent;
    private parseCounters;
}
