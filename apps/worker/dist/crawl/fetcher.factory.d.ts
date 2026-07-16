import { ConfigService } from '@nestjs/config';
import { SafeFetcher } from '@seo-guardian/crawler-core';
import type { Env } from '../config/env';
import type { CrawlConfig } from './crawl-config';
/**
 * Builds SSRF-guarded fetchers. In tests, CRAWLER_ALLOW_PRIVATE_TARGETS lets
 * the guard reach a localhost fixture server; in production it is empty, so
 * private address space stays blocked.
 */
export declare class FetcherFactory {
    private readonly config;
    private readonly allowPrivateTargets;
    constructor(config: ConfigService<Env, true>);
    create(crawlConfig: CrawlConfig): SafeFetcher;
}
