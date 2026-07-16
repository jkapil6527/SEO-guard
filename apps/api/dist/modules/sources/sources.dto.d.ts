/**
 * Creation payloads are separate DTOs per source type (discriminated by endpoint
 * body `type` handled in the service) to keep validation exact per shape.
 */
export declare class CreateManualSourceDto {
    type: 'manual';
    urls: string[];
}
export declare class CreateSitemapSourceDto {
    type: 'sitemap';
    sitemapUrl: string;
}
export declare class CreateDiscoverySourceDto {
    type: 'discovery';
    seeds: string[];
    maxDepth?: number;
    maxPages?: number;
}
export declare class CsvUploadFieldsDto {
    urlColumn?: string;
}
