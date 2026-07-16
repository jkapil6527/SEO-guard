import { ConfigService } from '@nestjs/config';
import { UrlSourcesRepository } from '@seo-guardian/db';
import { SafeFetcher } from '@seo-guardian/crawler-core';
import type { Env } from '../config/env';
import type { CrawlConfig } from './crawl-config';
export interface ResolvedSeed {
    url: string;
    /** discovery seeds carry depth 0 but permit expansion; listed URLs do not. */
    allowDiscovery: boolean;
    /**
     * <lastmod> from the sitemap, when the source had one. The parser has always
     * extracted this and the resolver used to throw it away; carrying it through
     * is what lets a category's incremental crawl skip pages the sitemap says are
     * unchanged.
     */
    lastmod?: Date | null;
}
/** Result of parsing a sitemap without committing to a crawl. */
export interface SitemapPreview {
    urls: string[];
    total: number;
    sitemapCount: number;
    truncated: boolean;
    errors: number;
}
/**
 * Resolves a crawl's starting URL set from all active sources of a website:
 * manual lists, CSV objects, sitemaps (recursed), and discovery seeds.
 * Normalizes and de-duplicates. Pure resolution — enqueuing happens in the
 * orchestrator.
 */
export declare class UrlResolverService {
    private readonly sources;
    private readonly config;
    private readonly logger;
    private readonly s3;
    private readonly uploadsBucket;
    constructor(sources: UrlSourcesRepository, config: ConfigService<Env, true>);
    resolve(websiteId: string, crawlConfig: CrawlConfig, fetcher: SafeFetcher): Promise<ResolvedSeed[]>;
    private resolveSource;
    /**
     * Resolve exactly one sitemap — the URL set of a single category. Bypasses
     * url_sources entirely: a group owns its sitemap URL directly.
     */
    resolveSitemap(sitemapUrl: string, crawlConfig: CrawlConfig, fetcher: SafeFetcher, maxUrls?: number): Promise<ResolvedSeed[]>;
    /** Parse a sitemap and report what it contains, without starting a crawl. */
    previewSitemap(sitemapUrl: string, crawlConfig: CrawlConfig, fetcher: SafeFetcher, sampleSize?: number): Promise<SitemapPreview>;
    private normalizeEntries;
    private normalizeList;
    private readCsvUrls;
}
