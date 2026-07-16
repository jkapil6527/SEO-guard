import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SitemapGroupsRepository, WebsitesRepository } from '@seo-guardian/db';
import type { SitemapGroupRow, SitemapGroupSummaryRow } from '@seo-guardian/db';
import { SafeFetcher, fetchSitemapTree, normalizeUrl } from '@seo-guardian/crawler-core';
import { CrawlMode, CrawlScope, ERROR_CODES } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import type { Env } from '../../config/env';
import { CrawlsService } from '../crawls/crawls.service';

/** What a sitemap contains, reported before any crawl is committed to. */
export interface SitemapPreview {
  sitemapUrl: string;
  total: number;
  sitemapCount: number;
  truncated: boolean;
  errors: number;
  sample: string[];
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'category'
  );
}

@Injectable()
export class SitemapGroupsService {
  constructor(
    private readonly groups: SitemapGroupsRepository,
    private readonly websites: WebsitesRepository,
    private readonly crawls: CrawlsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  listByProject(projectId: string): Promise<SitemapGroupSummaryRow[]> {
    return this.groups.listSummariesByProject(projectId);
  }

  async get(groupId: string): Promise<SitemapGroupRow> {
    const group = await this.groups.findById(groupId);
    if (!group) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'category not found' });
    }
    return group;
  }

  trend(groupId: string): Promise<Array<{ day: Date; seoScore: string }>> {
    return this.groups.trend(groupId);
  }

  async create(input: {
    websiteId: string;
    name: string;
    sitemapUrl?: string;
    actor: AuthUser;
  }): Promise<SitemapGroupRow> {
    const website = await this.websites.findById(input.websiteId);
    if (!website) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'website not found' });
    }
    const sitemapUrl = input.sitemapUrl
      ? this.assertSameOrigin(input.sitemapUrl, website.origin)
      : null;

    // Slugs are unique per website; disambiguate rather than reject, so two
    // websites in a project can both have a "News" category.
    const existing = await this.groups.listByWebsite(input.websiteId);
    const base = slugify(input.name);
    let slug = base;
    let n = 2;
    while (existing.some((g) => g.slug.toLowerCase() === slug.toLowerCase())) {
      slug = `${base}-${n++}`;
    }

    return this.groups.create({
      websiteId: input.websiteId,
      name: input.name.trim(),
      slug,
      sitemapUrl,
      createdBy: input.actor.id,
    });
  }

  async update(
    groupId: string,
    patch: { name?: string; sitemapUrl?: string; isActive?: boolean },
  ): Promise<SitemapGroupRow> {
    const group = await this.get(groupId);
    if (patch.sitemapUrl) {
      const website = await this.websites.findById(group.websiteId);
      if (website) this.assertSameOrigin(patch.sitemapUrl, website.origin);
    }
    const updated = await this.groups.update(groupId, patch);
    if (!updated) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'category not found' });
    }
    return updated;
  }

  async remove(groupId: string): Promise<void> {
    await this.get(groupId);
    await this.groups.remove(groupId);
  }

  /**
   * Parse a sitemap and report what it holds — URL count, how many nested
   * sitemaps it spans, and a sample — so the user can confirm before committing
   * to a crawl of it.
   */
  async preview(groupId: string, override?: string): Promise<SitemapPreview> {
    const group = await this.get(groupId);
    const website = await this.websites.findById(group.websiteId);
    if (!website) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'website not found' });
    }
    const target = override ?? group.sitemapUrl;
    if (!target) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'This category has no sitemap URL yet',
        errors: [{ field: 'sitemapUrl', message: 'Add a sitemap URL to crawl this category' }],
      });
    }
    const sitemapUrl = this.assertSameOrigin(target, website.origin);

    const fetcher = new SafeFetcher({
      userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
      timeoutMs: 20_000,
    });
    const tree = await fetchSitemapTree(sitemapUrl, fetcher, { maxUrls: 50_000 });
    const urls = tree.entries
      .map((e) => normalizeUrl(e.url))
      .filter((u): u is string => u !== null);

    return {
      sitemapUrl,
      total: urls.length,
      sitemapCount: tree.sitemapCount,
      truncated: tree.truncated,
      errors: tree.errors.length,
      sample: urls.slice(0, 8),
    };
  }

  /** Start a crawl covering exactly this category's sitemap. */
  async startCrawl(
    groupId: string,
    mode: CrawlMode,
    ctx: { actor: AuthUser; ip: string | null },
  ): Promise<{ crawlId: string; status: string }> {
    const group = await this.get(groupId);
    if (!group.sitemapUrl) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'This category has no sitemap URL yet',
        errors: [{ field: 'sitemapUrl', message: 'Add a sitemap URL to crawl this category' }],
      });
    }
    const crawl = await this.crawls.start(
      group.websiteId,
      mode,
      CrawlScope.Group,
      undefined,
      ctx,
      groupId,
    );
    return { crawlId: crawl.id, status: crawl.status };
  }

  /**
   * A sitemap must belong to the website it categorises — otherwise the URL is an
   * arbitrary fetch target chosen by the caller.
   */
  private assertSameOrigin(sitemapUrl: string, origin: string): string {
    let parsed: URL;
    try {
      parsed = new URL(sitemapUrl.trim());
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Enter a valid http(s) sitemap URL',
        errors: [{ field: 'sitemapUrl', message: 'Enter a valid http(s) URL' }],
      });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Enter a valid http(s) sitemap URL',
        errors: [{ field: 'sitemapUrl', message: 'Enter a valid http(s) URL' }],
      });
    }
    if (parsed.origin !== new URL(origin).origin) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `The sitemap must be on this website's origin (${origin})`,
        errors: [{ field: 'sitemapUrl', message: `The URL must start with ${origin}` }],
      });
    }
    return parsed.toString();
  }
}
