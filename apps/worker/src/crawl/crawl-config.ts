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

interface WebsiteSettings {
  renderPolicy?: RenderPolicy;
  userAgent?: string;
  ratePerSec?: number;
  domainConcurrency?: number;
  respectRobots?: boolean;
  allow?: string[];
  block?: string[];
}

export function resolveCrawlConfig(
  websiteSettings: Record<string, unknown>,
  defaults: {
    userAgent: string;
    ratePerSec: number;
    domainConcurrency: number;
  },
): CrawlConfig {
  const s = websiteSettings as WebsiteSettings;
  return {
    userAgent: s.userAgent ?? defaults.userAgent,
    renderPolicy: s.renderPolicy ?? 'auto',
    ratePerSec: clampNumber(s.ratePerSec, defaults.ratePerSec, 0.1, 50),
    domainConcurrency: clampNumber(s.domainConcurrency, defaults.domainConcurrency, 1, 16),
    maxRedirects: 5,
    timeoutMs: 15_000,
    respectRobots: s.respectRobots ?? true,
    discoveryMaxDepth: 3,
    discoveryMaxPages: 10_000,
    allow: Array.isArray(s.allow) ? s.allow : [],
    block: Array.isArray(s.block) ? s.block : [],
  };
}

/** Serialize for Redis HSET (all string values). */
export function serializeConfig(config: CrawlConfig): Record<string, string> {
  return {
    userAgent: config.userAgent,
    renderPolicy: config.renderPolicy,
    ratePerSec: String(config.ratePerSec),
    domainConcurrency: String(config.domainConcurrency),
    maxRedirects: String(config.maxRedirects),
    timeoutMs: String(config.timeoutMs),
    respectRobots: config.respectRobots ? '1' : '0',
    discoveryMaxDepth: String(config.discoveryMaxDepth),
    discoveryMaxPages: String(config.discoveryMaxPages),
    allow: JSON.stringify(config.allow),
    block: JSON.stringify(config.block),
  };
}

export function deserializeConfig(raw: Record<string, string>, fallback: CrawlConfig): CrawlConfig {
  if (!raw.userAgent) return fallback;
  return {
    userAgent: raw.userAgent,
    renderPolicy: (raw.renderPolicy as RenderPolicy) ?? 'auto',
    ratePerSec: Number(raw.ratePerSec ?? fallback.ratePerSec),
    domainConcurrency: Number(raw.domainConcurrency ?? fallback.domainConcurrency),
    maxRedirects: Number(raw.maxRedirects ?? 5),
    timeoutMs: Number(raw.timeoutMs ?? 15_000),
    respectRobots: raw.respectRobots !== '0',
    discoveryMaxDepth: Number(raw.discoveryMaxDepth ?? 3),
    discoveryMaxPages: Number(raw.discoveryMaxPages ?? 10_000),
    allow: safeParseArray(raw.allow),
    block: safeParseArray(raw.block),
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeParseArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
