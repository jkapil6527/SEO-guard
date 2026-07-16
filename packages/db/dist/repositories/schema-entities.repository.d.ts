import type { Database } from '../database';
export interface SchemaEntityRow {
    id: string;
    crawlId: string;
    snapshotId: string;
    pageId: string;
    websiteId: string;
    format: string;
    schemaType: string;
    status: string;
    properties: Record<string, unknown>;
    validation: Record<string, unknown>;
    richResults: unknown;
    confidence: string | null;
    createdAt: Date;
    url?: string;
}
/** A compact per-page schema summary used for cross-crawl diffing. */
export interface SchemaSummaryRow {
    pageId: string;
    url: string;
    schemaType: string;
    format: string;
    status: string;
    identity: string | null;
    entityHash: string;
    properties: Record<string, unknown>;
    richResults: unknown;
}
export declare class SchemaEntitiesRepository {
    private readonly db;
    constructor(db: Database);
    listByCrawl(crawlId: string, opts: {
        limit: number;
        cursor?: {
            createdAt: Date;
            id: string;
        };
        schemaType?: string;
        status?: string;
        format?: string;
    }): Promise<SchemaEntityRow[]>;
    listByPage(crawlId: string, pageId: string): Promise<SchemaEntityRow[]>;
    typeFrequency(crawlId: string): Promise<Array<{
        schemaType: string;
        count: number;
    }>>;
    statusCounts(crawlId: string): Promise<Array<{
        status: string;
        count: number;
    }>>;
    /** Coverage: total entities, and how many distinct pages carry any schema. */
    coverage(crawlId: string): Promise<{
        totalEntities: number;
        pagesWithSchema: number;
        richEligible: number;
    }>;
    /** Rich-result eligibility rollup by profile across a crawl. */
    richResultSummary(crawlId: string): Promise<Array<{
        profile: string;
        status: string;
        count: number;
    }>>;
    /** Distinct page ids that have any schema entity in the crawl. Cheap — no jsonb. */
    pageIdsWithSchema(crawlId: string): Promise<string[]>;
    /**
     * Per-page summaries for diffing a crawl against its predecessor, restricted to
     * a page batch so finalize never has to hold a whole crawl's structured data in
     * memory at once (a single large site can carry hundreds of MB of `properties`).
     *
     * Any single entity whose `properties` exceeds `maxPropertyBytes` is returned
     * with empty properties: such blobs are extraction artifacts (e.g. a whole
     * document captured as one value), not meaningfully diffable, and decoding them
     * into JS is exactly what exhausts the heap. The entity still diffs by hash, so
     * add/remove/modified detection is unaffected — only its property-level detail
     * is skipped.
     */
    loadSummariesForPages(crawlId: string, pageIds: string[], maxPropertyBytes?: number): Promise<SchemaSummaryRow[]>;
    /** Copies a previous snapshot's schema entities onto a carried-forward snapshot. */
    copyForCarryForward(fromCrawlId: string, fromSnapshotId: string, to: {
        crawlId: string;
        snapshotId: string;
        pageId: string;
        websiteId: string;
    }): Promise<number>;
}
