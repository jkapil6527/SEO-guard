import { WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CrawlsRepository, PageSnapshotsRepository, PagesRepository, SitemapGroupsRepository, WebsitesRepository } from '@seo-guardian/db';
import type { OrchestrateJobData } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import type { Env } from '../config/env';
import { CrawlProducerService } from '../crawl/crawl-producer.service';
import { FetcherFactory } from '../crawl/fetcher.factory';
import { UrlResolverService } from '../crawl/url-resolver.service';
import { CrawlStateService } from '../infra/crawl-state.service';
/**
 * Resolves a crawl's URL set from its sources, registers pages, seeds live
 * state, and fans out one page-fetch job per URL. Incremental crawls attach
 * conditional-request hints from the previous completed crawl.
 */
export declare class OrchestrateProcessor extends WorkerHost {
    private readonly crawls;
    private readonly websites;
    private readonly pages;
    private readonly snapshots;
    private readonly groups;
    private readonly resolver;
    private readonly fetcherFactory;
    private readonly producer;
    private readonly state;
    private readonly config;
    private readonly logger;
    constructor(crawls: CrawlsRepository, websites: WebsitesRepository, pages: PagesRepository, snapshots: PageSnapshotsRepository, groups: SitemapGroupsRepository, resolver: UrlResolverService, fetcherFactory: FetcherFactory, producer: CrawlProducerService, state: CrawlStateService, config: ConfigService<Env, true>);
    process(job: Job<OrchestrateJobData>): Promise<unknown>;
}
