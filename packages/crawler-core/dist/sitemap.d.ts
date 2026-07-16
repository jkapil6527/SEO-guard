import type { SafeFetcher } from './safe-fetcher';
import type { SitemapParseResult } from './types';
/**
 * Fetches a sitemap and recursively expands sitemap-index files.
 *
 * - Gzip payloads are detected by their magic bytes (0x1f 0x8b) and inflated;
 *   this covers `.gz` URLs and gzip content-types, while payloads the fetcher
 *   already decompressed at the transport layer pass through untouched.
 * - Recursion is bounded by `maxSitemaps` (default 50) documents fetched in
 *   total; hitting the bound sets `truncated`.
 * - Collection is bounded by `maxUrls` (default 50000) entries; hitting the
 *   bound sets `truncated`.
 * - Fetch and parse failures of nested sitemaps land in `errors`; the rest of
 *   the tree is still processed. Repeated sitemap and `loc` URLs are visited /
 *   emitted once.
 */
export declare function fetchSitemapTree(rootUrl: string, fetcher: SafeFetcher, opts?: {
    maxUrls?: number;
    maxSitemaps?: number;
}): Promise<SitemapParseResult>;
