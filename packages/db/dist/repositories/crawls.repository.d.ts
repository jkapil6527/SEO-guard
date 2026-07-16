import type { Database } from '../database';
export interface CrawlRow {
    id: string;
    websiteId: string;
    status: string;
    trigger: string;
    mode: string;
    scope: string;
    targetUrl: string | null;
    sitemapGroupId: string | null;
    rulePackVersion: string;
    stats: Record<string, number>;
    error: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdBy: string | null;
    createdAt: Date;
}
/** A crawl joined to the website/project it belongs to and its final score. */
export interface CrawlReportRow extends CrawlRow {
    websiteName: string;
    websiteOrigin: string;
    projectId: string;
    projectName: string;
    projectSlug: string;
    groupName: string | null;
    seoScore: string | null;
}
export declare class CrawlsRepository {
    private readonly db;
    constructor(db: Database);
    findById(id: string): Promise<CrawlRow | null>;
    /** A single crawl joined to its website/project/group, for the detail header. */
    findReportById(id: string): Promise<CrawlReportRow | null>;
    /**
     * Crawls that are effectively done but stuck: either sitting in 'finalizing'
     * (the finalize job died mid-run and no retry re-drove it), or still 'running'
     * with every page settled but finalize never completed. Bounded by a staleness
     * window so a genuinely-active crawl at 100% for a few seconds isn't disturbed.
     */
    findStuckFinalizing(staleBefore: Date): Promise<CrawlRow[]>;
    listByWebsite(websiteId: string, limit: number, beforeCreatedAt?: Date): Promise<CrawlRow[]>;
    /**
     * An in-flight crawl blocking a new one.
     *
     * Scoped to the sitemap group when one is given: the categories of a website
     * are independent, so a running "Model Pages" crawl must not block "Compare
     * Pages". A website-wide crawl (no group) still conflicts with everything,
     * since it covers all of them.
     */
    findActiveForScope(websiteId: string, sitemapGroupId?: string | null): Promise<CrawlRow | null>;
    /**
     * Latest fully completed crawl before the given one — the diff/incremental
     * baseline. Must match on group, or an incremental "Model Pages" crawl would
     * baseline against the last "Compare Pages" crawl and diff two unrelated URL
     * sets against each other.
     */
    findPreviousCompleted(websiteId: string, beforeCrawlId: string, sitemapGroupId?: string | null): Promise<CrawlRow | null>;
    /**
     * Crawls across every website, newest first — the workspace-wide report feed.
     * Left-joins the aggregate so in-flight crawls (which have no score yet) still
     * appear, and optionally narrows to one project.
     */
    listAll(limit: number, beforeCreatedAt?: Date, projectId?: string): Promise<CrawlReportRow[]>;
    create(input: {
        websiteId: string;
        trigger: string;
        mode: string;
        scope: string;
        targetUrl: string | null;
        sitemapGroupId?: string | null;
        rulePackVersion: string;
        createdBy: string | null;
    }): Promise<CrawlRow>;
    setStatus(id: string, status: string, patch?: {
        error?: string;
    }): Promise<void>;
    updateStats(id: string, stats: Record<string, number>): Promise<void>;
}
