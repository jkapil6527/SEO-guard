import type { Database } from '../database';
export interface LinkCheckInput {
    url: string;
    urlHash: Buffer;
    status: number | null;
    ok: boolean;
    isInternal: boolean;
    redirectHops: number;
    error: string | null;
}
export declare class LinkChecksRepository {
    private readonly db;
    constructor(db: Database);
    insertMany(crawlId: string, websiteId: string, checks: LinkCheckInput[]): Promise<void>;
    countBroken(crawlId: string): Promise<{
        count: number;
    } | null>;
}
