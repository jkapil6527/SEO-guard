/** API response shapes used by the dashboard. Kept in one place for reuse. */

export interface Project {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  myRole?: string;
}

export interface Website {
  id: string;
  projectId: string;
  name: string;
  origin: string;
  pathScope: string;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UrlSourceConfig =
  | { kind: 'manual'; urls: string[] }
  | {
      kind: 'csv';
      objectKey: string;
      originalFilename: string;
      urlColumn: string;
      rowCount: number;
    }
  | { kind: 'sitemap'; sitemapUrl: string }
  | { kind: 'discovery'; seeds: string[]; maxDepth: number; maxPages: number };

export interface UrlSource {
  id: string;
  websiteId: string;
  type: 'manual' | 'csv' | 'sitemap' | 'discovery';
  config: UrlSourceConfig;
  isActive: boolean;
  createdAt: string;
}

export interface Schedule {
  id: string;
  websiteId: string;
  cron: string;
  timezone: string;
  mode: 'full' | 'incremental';
  isActive: boolean;
  nextRunAt: string | null;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CrawlStatus =
  | 'queued'
  | 'resolving'
  | 'running'
  | 'paused'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CrawlScope = 'site' | 'page' | 'group';

/** A sitemap category — "Model Pages", "Compare Pages". */
export interface SitemapGroup {
  id: string;
  websiteId: string;
  name: string;
  slug: string;
  sitemapUrl: string | null;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** A category plus everything its dashboard card shows. */
export interface SitemapGroupSummary extends SitemapGroup {
  websiteName: string;
  websiteOrigin: string;
  projectId: string;
  totalUrls: number;
  lastCrawlId: string | null;
  lastCrawlStatus: CrawlStatus | null;
  lastCrawlAt: string | null;
  lastFinishedAt: string | null;
  healthScore: string | null;
  brokenUrls: number;
  errors: number;
  warnings: number;
  stats: { total?: number; crawled?: number; failed?: number } | null;
}

export interface SitemapPreview {
  sitemapUrl: string;
  total: number;
  sitemapCount: number;
  truncated: boolean;
  errors: number;
  sample: string[];
}

export interface Crawl {
  id: string;
  websiteId: string;
  status: CrawlStatus;
  trigger: string;
  mode: string;
  scope: CrawlScope;
  targetUrl: string | null;
  sitemapGroupId: string | null;
  stats: { total?: number; crawled?: number; unchanged?: number; failed?: number };
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  live?: CrawlProgress | null;
}

/** A crawl plus the website/project it belongs to and its final score. */
export interface CrawlReport extends Crawl {
  websiteName: string;
  websiteOrigin: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  groupName: string | null;
  seoScore: string | null;
}

export interface CrawlProgress {
  crawlId: string;
  status: string;
  total: number;
  crawled: number;
  unchanged: number;
  failed: number;
  queued: number;
  percent: number;
  currentUrl?: string;
  etaMs?: number;
  finishedAt?: string;
}

export interface PageSnapshot {
  id: string;
  crawlId: string;
  pageId: string;
  fetchStatus: 'ok' | 'unchanged' | 'redirected' | 'error' | 'carried_forward';
  httpStatus: number | null;
  score: string | null;
  issueCounts: Record<string, number>;
  rendered: boolean;
  artifacts: Record<string, unknown> | null;
  createdAt: string;
  url: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Issue {
  id: string;
  crawlId: string;
  pageId: string;
  checkId: string;
  severity: Severity;
  evidence: IssueEvidence;
  createdAt: string;
  url: string;
}

/**
 * What the engine recorded about a finding. `selector` and `snippet` locate it
 * in the document; both are absent on snapshots taken before element locations
 * were captured.
 */
export interface IssueEvidence {
  message?: string;
  technicalExplanation?: string;
  suggestedFix?: string;
  affectedElement?: string;
  selector?: string;
  snippet?: string;
  weight?: number;
  // duplicate.*
  value?: string;
  duplicateCount?: number;
  field?: string;
  // links / images
  target?: string;
  status?: number | null;
  error?: string | null;
  anchorText?: string;
  httpStatus?: number | null;
  redirectHops?: number;
  hops?: number;
  // headings
  from?: number;
  to?: number;
  level?: number;
  count?: number;
  texts?: string[];
  locations?: Array<{ selector?: string; snippet?: string }>;
  [key: string]: unknown;
}

/** Catalog metadata joined onto an issue: why it matters and how to fix it. */
export interface CheckMeta {
  name: string;
  category: string;
  description: string;
  technicalExplanation: string;
  businessImpact: string;
  suggestedFix: string;
  docUrl?: string;
  weight: number;
}

export interface DuplicateGroup {
  field: string;
  sample: string;
  pageCount: number;
  urls: string[];
}

/** An issue with everything the report needs to explain it. */
export interface IssueDetail extends Issue {
  check: CheckMeta | null;
  /** For duplicate.* findings: the other URLs sharing this exact value. */
  duplicateOf: { sample: string; pageCount: number; urls: string[] } | null;
}

export interface IssueSummary {
  byCheck: Array<{ checkId: string; severity: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  aggregate: {
    crawlId: string;
    websiteId: string;
    seoScore: string;
    metrics: CrawlMetrics;
  } | null;
}

export interface CrawlMetrics {
  scoringVersion?: number;
  pagesScored?: number;
  criticalPages?: number;
  issuesBySeverity?: Record<string, number>;
  brokenLinks?: number;
  schema?: SchemaMetrics;
}

export interface SchemaMetrics {
  totalEntities: number;
  pagesWithSchema: number;
  pagesWithoutSchema: number;
  richEligible: number;
  byStatus: Record<string, number>;
  typeFrequency: Array<{ schemaType: string; count: number }>;
  richResults: Array<{ profile: string; status: string; count: number }>;
}

export interface SchemaEntity {
  id: string;
  crawlId: string;
  pageId: string;
  format: string;
  schemaType: string;
  status: 'valid' | 'warnings' | 'errors' | 'invalid_json';
  properties: Record<string, unknown>;
  validation: {
    results?: SchemaValidationResult[];
    missingRequired?: string[];
    missingRecommended?: string[];
    invalidProperties?: string[];
    deprecatedProperties?: string[];
  };
  richResults: Array<{ profile: string; status: string; reason: string; eligible: boolean }> | null;
  confidence: string | null;
  createdAt: string;
  url: string;
}

export interface SchemaValidationResult {
  checkId: string;
  severity: string;
  status: string;
  message: string;
  suggestedFix: string;
  specUrl: string;
  property?: string;
  /** Names the offending value, e.g. `"March 16, 2026" is not a Date`. */
  technicalExplanation?: string;
  entityType?: string;
}

export interface SchemaCoverage {
  coverage: { totalEntities: number; pagesWithSchema: number; richEligible: number };
  typeFrequency: Array<{ schemaType: string; count: number }>;
  statusCounts: Array<{ status: string; count: number }>;
  aggregate: SchemaMetrics | null;
}

export interface CrawlChange {
  id: string;
  crawlId: string;
  pageId: string | null;
  changeType: string;
  severity: Severity;
  before: unknown;
  after: unknown;
  createdAt: string;
  url?: string;
}
