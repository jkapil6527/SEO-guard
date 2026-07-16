import type { Database } from '../database';
export interface IssueRow {
    id: string;
    crawlId: string;
    snapshotId: string;
    pageId: string;
    websiteId: string;
    checkId: string;
    severity: string;
    fingerprint: Buffer;
    evidence: Record<string, unknown>;
    createdAt: Date;
    url?: string;
}
export declare class PageIssuesRepository {
    private readonly db;
    constructor(db: Database);
    listByCrawl(crawlId: string, opts: {
        limit: number;
        cursor?: {
            createdAt: Date;
            id: string;
        };
        severity?: string[];
        checkId?: string;
    }): Promise<IssueRow[]>;
    /** Every issue on one page, newest-severity-first. */
    listByPage(crawlId: string, pageId: string): Promise<IssueRow[]>;
    /**
     * The OTHER pages sharing a duplicated title / description / h1 with this one.
     *
     * This is the "where" of a duplicate issue: a `duplicate.title` finding is
     * meaningless without the list of URLs it collides with. duplicate_groups has
     * held these page ids all along; nothing ever read them.
     */
    duplicateSiblings(crawlId: string, pageId: string): Promise<Array<{
        field: string;
        sample: string;
        pageCount: number;
        urls: string[];
    }>>;
    /** Duplicate groups across the crawl — the site-wide view of the same data. */
    listDuplicateGroups(crawlId: string, field?: string): Promise<Array<{
        field: string;
        sample: string;
        pageCount: number;
        urls: string[];
    }>>;
    summaryByCrawl(crawlId: string): Promise<Array<{
        checkId: string;
        severity: string;
        count: number;
    }>>;
    countsBySeverity(crawlId: string): Promise<Array<{
        severity: string;
        count: number;
    }>>;
    /**
     * Cross-page duplicate detection: groups snapshots sharing an artifact hash
     * and inserts one issue per affected page, plus a duplicate_groups row per
     * value. Runs entirely in SQL — no page data is pulled into the worker.
     */
    insertDuplicateIssues(input: {
        crawlId: string;
        websiteId: string;
        hashField: 'titleHash' | 'descriptionHash' | 'h1Hash';
        sampleField: 'title' | 'metaDescription' | 'h1Text';
        checkId: string;
        severity: string;
        duplicateField: string;
    }): Promise<number>;
    /**
     * Broken-link issues: for every broken target in link_checks, attach one
     * issue to each snapshot whose extracted links reference it (lateral join
     * over the links artifact).
     */
    insertBrokenLinkIssues(input: {
        crawlId: string;
        internalCheckId: string;
        internalSeverity: string;
        externalCheckId: string;
        externalSeverity: string;
    }): Promise<number>;
    /**
     * Broken-image issues: same lateral-join shape as broken links, but over the
     * images artifact. The per-page engine cannot emit this check because link
     * verification happens asynchronously after the page is processed.
     */
    insertBrokenImageIssues(input: {
        crawlId: string;
        checkId: string;
        severity: string;
    }): Promise<number>;
    /**
     * Redirect-chain issues: link_checks records redirect_hops, but nothing ever
     * consumed it. Attach an issue to each page linking to an over-long chain.
     */
    insertRedirectChainIssues(input: {
        crawlId: string;
        checkId: string;
        severity: string;
        maxHops: number;
    }): Promise<number>;
    /**
     * Recompute every snapshot's score and issue_counts from the COMPLETE issue
     * set for the crawl.
     *
     * The per-page score written during page processing only ever saw that page's
     * own rule failures — duplicate, broken-link, broken-image and redirect issues
     * are inserted here at finalize, after the fact. Without this pass those
     * deductions are silently missing from every page score, and from the site
     * average derived from them.
     *
     * Mirrors packages/seo-engine/src/scoring.ts exactly:
     *   100 − Σ_distinct_check( weight × (1 + log2(instances) × 0.1) × severityMultiplier )
     */
    recomputeSnapshotScores(crawlId: string): Promise<number>;
}
