/**
 * Public contract of @seo-guardian/crawler-core. The worker orchestration layer
 * compiles against these types; implementations live in sibling modules.
 */

export interface RedirectHop {
  url: string;
  status: number;
}

export interface FetchOptions {
  userAgent?: string;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBodyBytes?: number;
  headers?: Record<string, string>;
  /** Conditional request hints; a 304 yields notModified=true with no body. */
  etag?: string;
  lastModified?: string;
  method?: 'GET' | 'HEAD';
}

export type FetchErrorCode =
  | 'SSRF_BLOCKED'
  | 'DNS_ERROR'
  | 'TIMEOUT'
  | 'TOO_MANY_REDIRECTS'
  | 'BODY_TOO_LARGE'
  | 'UNSUPPORTED_PROTOCOL'
  | 'CONNECTION_ERROR';

export interface FetchResult {
  /** URL after redirects (normalized). Equals the request URL when none. */
  finalUrl: string;
  /** HTTP status of the final response; 0 when a transport error occurred. */
  status: number;
  /** True for 2xx and 304. */
  ok: boolean;
  notModified: boolean;
  headers: Record<string, string>;
  /** Decompressed body; absent for HEAD, 304, or transport errors. */
  body?: Buffer;
  redirectChain: RedirectHop[];
  timings: { totalMs: number };
  /** Set instead of throwing for transport-level failures. */
  error?: { code: FetchErrorCode; message: string };
}

export interface SafeFetcherOptions {
  userAgent: string;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBodyBytes?: number;
  /** Test hook: additionally allow these host:port targets even if private (fixture servers). */
  allowPrivateTargets?: string[];
}

export interface RobotsRules {
  /** Longest-match precedence per REP; checks the most specific user-agent group. */
  isAllowed(url: string, userAgent: string): boolean;
  crawlDelayMs(userAgent: string): number | null;
  sitemaps: string[];
}

export interface SitemapEntry {
  url: string;
  lastmod?: string;
}

export interface SitemapParseResult {
  entries: SitemapEntry[];
  /** Nested sitemap URLs that failed to fetch/parse; the crawl proceeds without them. */
  errors: Array<{ url: string; message: string }>;
  truncated: boolean;
  /** Sitemap documents visited, including the root — an index counts itself plus its children. */
  sitemapCount: number;
}

export interface NormalizeOptions {
  /** Drop query parameters entirely (default false: kept, sorted). */
  stripQuery?: boolean;
  /** Query params always removed (tracking params). */
  stripParams?: string[];
}

export interface UrlFilterOptions {
  origin: string;
  pathScope?: string;
  /** Glob-style path patterns; when non-empty, only matching paths are allowed. */
  allow?: string[];
  /** Glob-style path patterns rejected even if allowed. */
  block?: string[];
}
