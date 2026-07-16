import type { Database } from '../database';
export interface CrawlAggregateRow {
    crawlId: string;
    websiteId: string;
    seoScore: string;
    metrics: Record<string, unknown>;
    createdAt: Date;
}
export declare class CrawlAggregatesRepository {
    private readonly db;
    constructor(db: Database);
    upsert(input: {
        crawlId: string;
        websiteId: string;
        seoScore: number;
        metrics: Record<string, unknown>;
    }): Promise<void>;
    findByCrawl(crawlId: string): Promise<CrawlAggregateRow | null>;
    /** trend_daily: last crawl of the day wins. */
    upsertTrendDay(input: {
        websiteId: string;
        crawlId: string;
        seoScore: number;
        metrics: Record<string, unknown>;
    }): Promise<void>;
    /**
     * Per-category trend. trend_daily is keyed (website_id, day) and so can only
     * hold one score per website per day — this parallel table is what gives each
     * sitemap group its own history and card sparkline.
     */
    upsertGroupTrendDay(input: {
        sitemapGroupId: string;
        crawlId: string;
        seoScore: number;
        metrics: Record<string, unknown>;
    }): Promise<void>;
    /** Site score components: mean page score + share of pages with critical issues. */
    scoreComponents(crawlId: string): Promise<{
        avgScore: string | null;
        scoredPages: number;
        criticalPages: number;
    } | null>;
}
