import type { OnModuleDestroy } from '@nestjs/common';
import type { CrawlProgressEvent } from '@seo-guardian/shared';
import { Redis } from 'ioredis';
import { Observable } from 'rxjs';
/**
 * API-side live crawl state: reads counters/flags the workers maintain in
 * Redis, sets pause/cancel flags, and bridges the crawl's pub/sub channel to
 * an SSE stream.
 */
export declare class CrawlProgressService implements OnModuleDestroy {
    private readonly redis;
    private readonly subscriber;
    private readonly logger;
    constructor(redis: Redis, subscriber: Redis);
    requestCancel(crawlId: string): Promise<void>;
    setPaused(crawlId: string, paused: boolean): Promise<void>;
    snapshot(crawlId: string): Promise<CrawlProgressEvent | null>;
    /** SSE stream: emits the current snapshot then every published update. */
    stream(crawlId: string): Observable<CrawlProgressEvent>;
    onModuleDestroy(): Promise<void>;
    private build;
}
