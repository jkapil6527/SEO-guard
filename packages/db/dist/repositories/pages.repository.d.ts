import type { Database } from '../database';
export interface PageRef {
    id: string;
    url: string;
}
export declare class PagesRepository {
    private readonly db;
    constructor(db: Database);
    /**
     * Bulk upsert of normalized URLs; returns id+url for every input. Uses a
     * single VALUES list per chunk — the orchestrator calls this with thousands
     * of URLs, so no row-at-a-time round trips.
     */
    upsertMany(websiteId: string, entries: Array<{
        url: string;
        urlHash: Buffer;
    }>): Promise<PageRef[]>;
    upsertOne(websiteId: string, url: string, urlHash: Buffer): Promise<PageRef>;
}
