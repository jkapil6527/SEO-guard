import { WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { LinkChecksRepository, WebsitesRepository } from '@seo-guardian/db';
import type { LinkCheckJobData } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import type { Env } from '../config/env';
import { FetcherFactory } from '../crawl/fetcher.factory';
import { CrawlStateService } from '../infra/crawl-state.service';
import { PolitenessService } from '../infra/politeness.service';
/**
 * Verifies a batch of unique outbound link targets with HEAD (GET fallback),
 * subject to the same per-domain politeness. Results persist once per crawl and
 * are joined back into per-page broken-link issues by the finalizer.
 */
export declare class LinkCheckProcessor extends WorkerHost {
    private readonly linkChecks;
    private readonly websites;
    private readonly fetcherFactory;
    private readonly politeness;
    private readonly state;
    private readonly config;
    constructor(linkChecks: LinkChecksRepository, websites: WebsitesRepository, fetcherFactory: FetcherFactory, politeness: PolitenessService, state: CrawlStateService, config: ConfigService<Env, true>);
    process(job: Job<LinkCheckJobData>): Promise<unknown>;
}
