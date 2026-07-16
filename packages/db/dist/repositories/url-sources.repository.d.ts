import type { Database } from '../database';
export type UrlSourceConfig = {
    kind: 'manual';
    urls: string[];
} | {
    kind: 'csv';
    objectKey: string;
    originalFilename: string;
    urlColumn: string;
    rowCount: number;
} | {
    kind: 'sitemap';
    sitemapUrl: string;
} | {
    kind: 'discovery';
    seeds: string[];
    maxDepth: number;
    maxPages: number;
};
export interface UrlSourceRow {
    id: string;
    websiteId: string;
    type: string;
    config: UrlSourceConfig;
    isActive: boolean;
    createdBy: string | null;
    createdAt: Date;
}
export declare class UrlSourcesRepository {
    private readonly db;
    constructor(db: Database);
    findById(id: string): Promise<UrlSourceRow | null>;
    listByWebsite(websiteId: string): Promise<UrlSourceRow[]>;
    create(input: {
        websiteId: string;
        type: string;
        config: UrlSourceConfig;
        createdBy: string;
    }): Promise<UrlSourceRow>;
    setActive(id: string, isActive: boolean): Promise<UrlSourceRow | null>;
    delete(id: string): Promise<boolean>;
    websiteIdOf(sourceId: string): Promise<string | null>;
}
