import type { Database } from '../database';
export interface CrawlChangeInput {
    pageId: string | null;
    changeType: string;
    severity: string;
    before: unknown;
    after: unknown;
}
export interface CrawlChangeRow {
    id: string;
    crawlId: string;
    websiteId: string;
    pageId: string | null;
    changeType: string;
    severity: string;
    before: unknown;
    after: unknown;
    createdAt: Date;
    url?: string;
}
export declare class CrawlChangesRepository {
    private readonly db;
    constructor(db: Database);
    insertMany(crawlId: string, websiteId: string, changes: CrawlChangeInput[]): Promise<number>;
    listByCrawl(crawlId: string, opts: {
        limit: number;
        cursor?: {
            createdAt: Date;
            id: string;
        };
        changeType?: string;
        severity?: string[];
        changeTypes?: string[];
    }): Promise<CrawlChangeRow[]>;
    summary(crawlId: string): Promise<Array<{
        changeType: string;
        count: number;
    }>>;
}
