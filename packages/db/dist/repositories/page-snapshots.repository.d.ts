import type { Database } from '../database';
export interface SnapshotInput {
    crawlId: string;
    pageId: string;
    websiteId: string;
    fetchStatus: 'ok' | 'unchanged' | 'redirected' | 'error' | 'carried_forward';
    httpStatus: number | null;
    redirectChain: unknown[] | null;
    contentHash: Buffer | null;
    artifacts: Record<string, unknown> | null;
    score: number | null;
    issueCounts: Record<string, number>;
    timingMs: Record<string, number> | null;
    rendered: boolean;
}
export interface IssueInput {
    checkId: string;
    severity: string;
    fingerprint: Buffer;
    evidence: Record<string, unknown>;
}
/** A normalized schema entity to persist alongside a snapshot. */
export interface SchemaEntityInput {
    format: 'json-ld' | 'microdata' | 'rdfa';
    schemaType: string;
    status: 'valid' | 'warnings' | 'errors' | 'invalid_json';
    identity: string | null;
    properties: unknown;
    validation: unknown;
    richResults: unknown;
    entityHash: Buffer;
    confidence: number;
}
export interface SnapshotRow {
    id: string;
    crawlId: string;
    pageId: string;
    websiteId: string;
    fetchStatus: string;
    httpStatus: number | null;
    redirectChain: unknown[] | null;
    contentHash: Buffer | null;
    artifacts: Record<string, unknown> | null;
    score: string | null;
    issueCounts: Record<string, number>;
    rendered: boolean;
    createdAt: Date;
    url?: string;
}
export declare class PageSnapshotsRepository {
    private readonly db;
    constructor(db: Database);
    /**
     * Idempotent persistence for at-least-once job delivery: any prior snapshot
     * for (crawl, page) and its issues are replaced in one transaction, so a
     * retried job cannot double-write.
     */
    replaceSnapshot(snapshot: SnapshotInput, issues: IssueInput[], schemaEntities?: SchemaEntityInput[]): Promise<{
        id: string;
        existed: boolean;
    }>;
    private insertSchemaEntities;
    private insertIssues;
    /** Conditional-request hints for every page of a crawl (incremental baseline). */
    loadConditionalHints(crawlId: string): Promise<Array<{
        pageId: string;
        snapshotId: string;
        etag: string | null;
        lastModified: string | null;
        contentHash: Buffer | null;
    }>>;
    findByCrawlAndPage(crawlId: string, pageId: string): Promise<SnapshotRow | null>;
    listByCrawl(crawlId: string, opts: {
        limit: number;
        cursor?: {
            createdAt: Date;
            id: string;
        };
        fetchStatus?: string;
    }): Promise<SnapshotRow[]>;
    /** Copies a previous snapshot's issues onto a carried-forward snapshot. */
    copyIssues(fromCrawlId: string, fromSnapshotId: string, to: {
        crawlId: string;
        snapshotId: string;
        pageId: string;
        websiteId: string;
    }): Promise<number>;
    /** Pages whose fetch errored — retry-failed re-enqueues exactly these. */
    listFailedPages(crawlId: string): Promise<Array<{
        pageId: string;
        url: string;
    }>>;
}
