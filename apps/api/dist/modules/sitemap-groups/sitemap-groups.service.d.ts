import { ConfigService } from '@nestjs/config';
import { SitemapGroupsRepository, WebsitesRepository } from '@seo-guardian/db';
import type { SitemapGroupRow, SitemapGroupSummaryRow } from '@seo-guardian/db';
import { CrawlMode } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import type { Env } from '../../config/env';
import { CrawlsService } from '../crawls/crawls.service';
/** What a sitemap contains, reported before any crawl is committed to. */
export interface SitemapPreview {
    sitemapUrl: string;
    total: number;
    sitemapCount: number;
    truncated: boolean;
    errors: number;
    sample: string[];
}
export declare class SitemapGroupsService {
    private readonly groups;
    private readonly websites;
    private readonly crawls;
    private readonly config;
    constructor(groups: SitemapGroupsRepository, websites: WebsitesRepository, crawls: CrawlsService, config: ConfigService<Env, true>);
    listByProject(projectId: string): Promise<SitemapGroupSummaryRow[]>;
    get(groupId: string): Promise<SitemapGroupRow>;
    trend(groupId: string): Promise<Array<{
        day: Date;
        seoScore: string;
    }>>;
    create(input: {
        websiteId: string;
        name: string;
        sitemapUrl?: string;
        actor: AuthUser;
    }): Promise<SitemapGroupRow>;
    update(groupId: string, patch: {
        name?: string;
        sitemapUrl?: string;
        isActive?: boolean;
    }): Promise<SitemapGroupRow>;
    remove(groupId: string): Promise<void>;
    /**
     * Parse a sitemap and report what it holds — URL count, how many nested
     * sitemaps it spans, and a sample — so the user can confirm before committing
     * to a crawl of it.
     */
    preview(groupId: string, override?: string): Promise<SitemapPreview>;
    /** Start a crawl covering exactly this category's sitemap. */
    startCrawl(groupId: string, mode: CrawlMode, ctx: {
        actor: AuthUser;
        ip: string | null;
    }): Promise<{
        crawlId: string;
        status: string;
    }>;
    /**
     * A sitemap must belong to the website it categorises — otherwise the URL is an
     * arbitrary fetch target chosen by the caller.
     */
    private assertSameOrigin;
}
