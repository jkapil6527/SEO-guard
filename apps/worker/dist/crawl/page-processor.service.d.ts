import { ConfigService } from '@nestjs/config';
import { CrawlsRepository, PageSnapshotsRepository, PagesRepository, SchemaEntitiesRepository } from '@seo-guardian/db';
import type { FetchResult } from '@seo-guardian/crawler-core';
import type { PageFetchJobData } from '@seo-guardian/shared';
import type { Env } from '../config/env';
import { CrawlProducerService } from './crawl-producer.service';
import { FetcherFactory } from './fetcher.factory';
import { CrawlStateService } from '../infra/crawl-state.service';
import { HtmlStorageService } from '../infra/html-storage.service';
import { PolitenessService } from '../infra/politeness.service';
export interface PageProcessOutcome {
    outcome: 'crawled' | 'unchanged' | 'failed';
    /** True when the page was handed to the render queue; the render path owns progress. */
    routedToRender?: boolean;
}
/** Signals that BullMQ should delay-retry the job (politeness backpressure). */
export declare class RateLimitedError extends Error {
    readonly retryInMs: number;
    constructor(retryInMs: number);
}
/**
 * Processes one page end to end: politeness gate, conditional fetch, optional
 * render, artifact extraction, SEO validation, idempotent persistence,
 * discovery expansion, progress publication, and completion detection.
 * Shared by the fetch and render processors.
 */
export declare class PageProcessorService {
    private readonly crawls;
    private readonly pages;
    private readonly snapshots;
    private readonly schemaEntities;
    private readonly producer;
    private readonly fetcherFactory;
    private readonly storage;
    private readonly politeness;
    private readonly state;
    private readonly config;
    private readonly logger;
    constructor(crawls: CrawlsRepository, pages: PagesRepository, snapshots: PageSnapshotsRepository, schemaEntities: SchemaEntitiesRepository, producer: CrawlProducerService, fetcherFactory: FetcherFactory, storage: HtmlStorageService, politeness: PolitenessService, state: CrawlStateService, config: ConfigService<Env, true>);
    /** Entry point for the static fetch path. */
    processFetch(data: PageFetchJobData): Promise<PageProcessOutcome>;
    /** Entry point for the Playwright render path (rendered DOM supplied). */
    processRendered(data: PageFetchJobData, renderedHtml: string, result: FetchResult): Promise<PageProcessOutcome>;
    private validateAndPersist;
    /**
     * A page unchanged since the previous crawl: create a new snapshot marked
     * carried_forward that inherits the prior artifacts/score, and copy its issues
     * so history and diffs stay complete without re-fetching or re-validating.
     */
    private carryForward;
    private persistFetchError;
    /** Records progress and, when the crawl's pages have all settled, triggers finalize. */
    finishPage(data: PageFetchJobData, outcome: PageProcessOutcome['outcome']): Promise<void>;
    private enqueueLinkTargets;
    private expandDiscovery;
    private gatePoliteness;
    private shouldSkip;
    private loadConfig;
    /** Heuristic: server-rendered pages expose content; near-empty body root ⇒ needs JS. */
    private needsRender;
    private toIssues;
    /** Maps schema-engine output to persistable entity rows (one per top-level entity). */
    private toSchemaEntities;
}
