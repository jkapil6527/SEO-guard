import type { Database } from '../database';
export interface SitemapGroupRow {
    id: string;
    websiteId: string;
    name: string;
    slug: string;
    sitemapUrl: string | null;
    urlSourceId: string | null;
    isActive: boolean;
    settings: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
/** A group plus everything the project-dashboard card needs, in one row. */
export interface SitemapGroupSummaryRow extends SitemapGroupRow {
    websiteName: string;
    websiteOrigin: string;
    projectId: string;
    totalUrls: number;
    lastCrawlId: string | null;
    lastCrawlStatus: string | null;
    lastCrawlAt: Date | null;
    lastFinishedAt: Date | null;
    healthScore: string | null;
    brokenUrls: number;
    errors: number;
    warnings: number;
    stats: Record<string, number> | null;
}
export declare class SitemapGroupsRepository {
    private readonly db;
    constructor(db: Database);
    findById(id: string): Promise<SitemapGroupRow | null>;
    listByWebsite(websiteId: string): Promise<SitemapGroupRow[]>;
    /**
     * Every group in a project with its latest crawl rolled up — the whole project
     * dashboard in one query. Doing this client-side would be an N+1 across
     * groups, crawls and aggregates.
     *
     * `errors` and `warnings` map the five severities onto the two buckets the
     * card shows: critical+high are errors, medium+low+info are warnings.
     */
    listSummariesByProject(projectId: string): Promise<SitemapGroupSummaryRow[]>;
    /** 30-day score history for a group's card sparkline. */
    trend(groupId: string, days?: number): Promise<Array<{
        day: Date;
        seoScore: string;
    }>>;
    create(input: {
        websiteId: string;
        name: string;
        slug: string;
        sitemapUrl: string | null;
        urlSourceId?: string | null;
        createdBy: string | null;
    }): Promise<SitemapGroupRow>;
    update(id: string, patch: {
        name?: string;
        sitemapUrl?: string | null;
        isActive?: boolean;
    }): Promise<SitemapGroupRow | null>;
    remove(id: string): Promise<void>;
    /** Record which pages belong to this group, with the sitemap's lastmod. */
    linkPages(groupId: string, pages: Array<{
        pageId: string;
        lastmod: Date | null;
    }>): Promise<void>;
}
