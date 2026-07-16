import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UrlSourcesRepository } from '@seo-guardian/db';
import type { UrlSourceRow } from '@seo-guardian/db';
import { SafeFetcher, fetchSitemapTree, normalizeUrl } from '@seo-guardian/crawler-core';
import { parse as parseCsv } from 'csv-parse/sync';
import type { Env } from '../config/env';
import type { CrawlConfig } from './crawl-config';

export interface ResolvedSeed {
  url: string;
  /** discovery seeds carry depth 0 but permit expansion; listed URLs do not. */
  allowDiscovery: boolean;
  /**
   * <lastmod> from the sitemap, when the source had one. The parser has always
   * extracted this and the resolver used to throw it away; carrying it through
   * is what lets a category's incremental crawl skip pages the sitemap says are
   * unchanged.
   */
  lastmod?: Date | null;
}

/** Result of parsing a sitemap without committing to a crawl. */
export interface SitemapPreview {
  urls: string[];
  total: number;
  sitemapCount: number;
  truncated: boolean;
  errors: number;
}

/**
 * Resolves a crawl's starting URL set from all active sources of a website:
 * manual lists, CSV objects, sitemaps (recursed), and discovery seeds.
 * Normalizes and de-duplicates. Pure resolution — enqueuing happens in the
 * orchestrator.
 */
@Injectable()
export class UrlResolverService {
  private readonly logger = new Logger(UrlResolverService.name);
  private readonly s3: S3Client;
  private readonly uploadsBucket: string;

  constructor(
    private readonly sources: UrlSourcesRepository,
    private readonly config: ConfigService<Env, true>,
  ) {
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    this.uploadsBucket = 'seo-guardian-uploads';
    this.s3 = new S3Client({
      region: config.get('S3_REGION', { infer: true }),
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
    });
  }

  async resolve(
    websiteId: string,
    crawlConfig: CrawlConfig,
    fetcher: SafeFetcher,
  ): Promise<ResolvedSeed[]> {
    const sources = (await this.sources.listByWebsite(websiteId)).filter((s) => s.isActive);
    const seeds = new Map<string, ResolvedSeed>();

    for (const source of sources) {
      try {
        const resolved = await this.resolveSource(source, crawlConfig, fetcher);
        for (const seed of resolved) {
          const existing = seeds.get(seed.url);
          if (!existing) seeds.set(seed.url, seed);
          else if (seed.allowDiscovery) existing.allowDiscovery = true;
        }
      } catch (err) {
        this.logger.error(
          { err, sourceId: source.id, type: source.type },
          'source resolution failed',
        );
      }
    }
    return [...seeds.values()];
  }

  private async resolveSource(
    source: UrlSourceRow,
    crawlConfig: CrawlConfig,
    fetcher: SafeFetcher,
  ): Promise<ResolvedSeed[]> {
    const cfg = source.config;
    switch (cfg.kind) {
      case 'manual':
        return this.normalizeList(cfg.urls, false);
      case 'discovery':
        return this.normalizeList(cfg.seeds, true);
      case 'csv':
        return this.normalizeList(await this.readCsvUrls(cfg.objectKey, cfg.urlColumn), false);
      case 'sitemap': {
        const tree = await fetchSitemapTree(cfg.sitemapUrl, fetcher, {
          maxUrls: crawlConfig.discoveryMaxPages,
        });
        if (tree.errors.length > 0) {
          this.logger.warn(
            { sourceId: source.id, errors: tree.errors.length },
            'sitemap partial errors',
          );
        }
        return this.normalizeEntries(tree.entries);
      }
      default:
        return [];
    }
  }

  /**
   * Resolve exactly one sitemap — the URL set of a single category. Bypasses
   * url_sources entirely: a group owns its sitemap URL directly.
   */
  async resolveSitemap(
    sitemapUrl: string,
    crawlConfig: CrawlConfig,
    fetcher: SafeFetcher,
    maxUrls?: number,
  ): Promise<ResolvedSeed[]> {
    const tree = await fetchSitemapTree(sitemapUrl, fetcher, {
      maxUrls: maxUrls ?? crawlConfig.discoveryMaxPages,
    });
    if (tree.errors.length > 0) {
      this.logger.warn({ sitemapUrl, errors: tree.errors.length }, 'sitemap partial errors');
    }
    return this.normalizeEntries(tree.entries);
  }

  /** Parse a sitemap and report what it contains, without starting a crawl. */
  async previewSitemap(
    sitemapUrl: string,
    crawlConfig: CrawlConfig,
    fetcher: SafeFetcher,
    sampleSize = 10,
  ): Promise<SitemapPreview> {
    const tree = await fetchSitemapTree(sitemapUrl, fetcher, {
      maxUrls: crawlConfig.discoveryMaxPages,
    });
    const seeds = this.normalizeEntries(tree.entries);
    return {
      urls: seeds.slice(0, sampleSize).map((s) => s.url),
      total: seeds.length,
      sitemapCount: tree.sitemapCount ?? 1,
      truncated: tree.truncated,
      errors: tree.errors.length,
    };
  }

  private normalizeEntries(
    entries: Array<{ url: string; lastmod?: string | null }>,
  ): ResolvedSeed[] {
    const out: ResolvedSeed[] = [];
    for (const entry of entries) {
      const normalized = normalizeUrl(entry.url);
      if (!normalized) continue;
      const lastmod = entry.lastmod ? new Date(entry.lastmod) : null;
      out.push({
        url: normalized,
        allowDiscovery: false,
        lastmod: lastmod && !Number.isNaN(lastmod.getTime()) ? lastmod : null,
      });
    }
    return out;
  }

  private normalizeList(urls: string[], allowDiscovery: boolean): ResolvedSeed[] {
    const out: ResolvedSeed[] = [];
    for (const raw of urls) {
      const normalized = normalizeUrl(raw);
      if (normalized) out.push({ url: normalized, allowDiscovery });
    }
    return out;
  }

  private async readCsvUrls(objectKey: string, urlColumn: string): Promise<string[]> {
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: this.uploadsBucket, Key: objectKey }),
    );
    const body = await res.Body?.transformToByteArray();
    if (!body) return [];
    const records = parseCsv(Buffer.from(body), {
      columns: true,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Array<Record<string, string>>;
    return records.map((r) => r[urlColumn] ?? '').filter(Boolean);
  }
}
