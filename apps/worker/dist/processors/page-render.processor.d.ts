import { WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { PageFetchJobData } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import type { Env } from '../config/env';
import { BrowserPoolService } from '../crawl/browser-pool.service';
import { FetcherFactory } from '../crawl/fetcher.factory';
import { PageProcessorService } from '../crawl/page-processor.service';
import { CrawlStateService } from '../infra/crawl-state.service';
/**
 * JavaScript render path. Re-fetches through the SSRF-guarded fetcher (to
 * validate the target and capture headers/redirects), renders the validated
 * final URL with Playwright, then runs the same validate-and-persist path.
 * Falls back to the static body when rendering fails.
 */
export declare class PageRenderProcessor extends WorkerHost {
    private readonly pageProcessor;
    private readonly fetcherFactory;
    private readonly browserPool;
    private readonly state;
    private readonly config;
    constructor(pageProcessor: PageProcessorService, fetcherFactory: FetcherFactory, browserPool: BrowserPoolService, state: CrawlStateService, config: ConfigService<Env, true>);
    process(job: Job<PageFetchJobData>, token?: string): Promise<unknown>;
}
