/**
 * Effective crawl configuration resolved from website + project settings, with
 * env-backed defaults. Persisted into Redis (crawl:config) so every worker
 * reads identical values for the crawl's lifetime.
 */
export type RenderPolicy = 'never' | 'always' | 'auto';
export interface CrawlConfig {
    userAgent: string;
    renderPolicy: RenderPolicy;
    ratePerSec: number;
    domainConcurrency: number;
    maxRedirects: number;
    timeoutMs: number;
    respectRobots: boolean;
    discoveryMaxDepth: number;
    discoveryMaxPages: number;
    allow: string[];
    block: string[];
}
export declare function resolveCrawlConfig(websiteSettings: Record<string, unknown>, defaults: {
    userAgent: string;
    ratePerSec: number;
    domainConcurrency: number;
}): CrawlConfig;
/** Serialize for Redis HSET (all string values). */
export declare function serializeConfig(config: CrawlConfig): Record<string, string>;
export declare function deserializeConfig(raw: Record<string, string>, fallback: CrawlConfig): CrawlConfig;
