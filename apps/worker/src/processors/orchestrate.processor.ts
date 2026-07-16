import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CrawlsRepository,
  PageSnapshotsRepository,
  PagesRepository,
  SitemapGroupsRepository,
  WebsitesRepository,
} from '@seo-guardian/db';
import { normalizeUrl, urlHash } from '@seo-guardian/crawler-core';
import { ENGINE_VERSION } from '@seo-guardian/seo-engine';
import { CrawlScope, CrawlStatus, QUEUES } from '@seo-guardian/shared';
import type { OrchestrateJobData, PageFetchJobData } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import type { Env } from '../config/env';
import { resolveCrawlConfig, serializeConfig } from '../crawl/crawl-config';
import { CrawlProducerService } from '../crawl/crawl-producer.service';
import { FetcherFactory } from '../crawl/fetcher.factory';
import { UrlResolverService } from '../crawl/url-resolver.service';
import type { ResolvedSeed } from '../crawl/url-resolver.service';
import { CrawlStateService } from '../infra/crawl-state.service';

/**
 * Resolves a crawl's URL set from its sources, registers pages, seeds live
 * state, and fans out one page-fetch job per URL. Incremental crawls attach
 * conditional-request hints from the previous completed crawl.
 */
@Processor(QUEUES.CRAWL_ORCHESTRATE, { concurrency: 4 })
export class OrchestrateProcessor extends WorkerHost {
  private readonly logger = new Logger(OrchestrateProcessor.name);

  constructor(
    private readonly crawls: CrawlsRepository,
    private readonly websites: WebsitesRepository,
    private readonly pages: PagesRepository,
    private readonly snapshots: PageSnapshotsRepository,
    private readonly groups: SitemapGroupsRepository,
    private readonly resolver: UrlResolverService,
    private readonly fetcherFactory: FetcherFactory,
    private readonly producer: CrawlProducerService,
    private readonly state: CrawlStateService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  override async process(job: Job<OrchestrateJobData>): Promise<unknown> {
    const { crawlId } = job.data;
    const crawl = await this.crawls.findById(crawlId);
    if (!crawl) {
      this.logger.warn(`crawl ${crawlId} vanished before orchestration`);
      return { resolved: 0 };
    }
    if (await this.state.isCancelled(crawlId)) {
      await this.crawls.setStatus(crawlId, CrawlStatus.Cancelled);
      return { cancelled: true };
    }

    const website = await this.websites.findById(crawl.websiteId);
    if (!website) {
      await this.crawls.setStatus(crawlId, CrawlStatus.Failed, { error: 'website deleted' });
      return { failed: true };
    }

    await this.crawls.setStatus(crawlId, CrawlStatus.Resolving);
    const crawlConfig = resolveCrawlConfig(website.settings, {
      userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
      ratePerSec: this.config.get('DEFAULT_DOMAIN_RATE_PER_SEC', { infer: true }),
      domainConcurrency: this.config.get('DEFAULT_DOMAIN_CONCURRENCY', { infer: true }),
    });

    let seeds: ResolvedSeed[];
    if (crawl.scope === CrawlScope.Page) {
      // Page scope: the crawl's single target, and nothing else. Discovery is
      // off, so link extraction never expands the frontier.
      const target = crawl.targetUrl ? normalizeUrl(crawl.targetUrl) : null;
      if (!target) {
        await this.crawls.setStatus(crawlId, CrawlStatus.Failed, {
          error: `Single-page crawl has no valid target URL (${crawl.targetUrl ?? 'none'}).`,
        });
        await this.state.init(crawlId, 0, serializeConfig(crawlConfig));
        return { resolved: 0 };
      }
      seeds = [{ url: target, allowDiscovery: false }];
      this.logger.log(`crawl ${crawlId}: single-page crawl of ${target}`);
    } else if (crawl.scope === CrawlScope.Group) {
      // Category scope: exactly the URLs of this group's sitemap. No discovery,
      // no other sources of the website.
      const group = crawl.sitemapGroupId
        ? await this.groups.findById(crawl.sitemapGroupId)
        : null;
      if (!group?.sitemapUrl) {
        await this.crawls.setStatus(crawlId, CrawlStatus.Failed, {
          error: 'This category has no sitemap URL. Add one before crawling it.',
        });
        await this.state.init(crawlId, 0, serializeConfig(crawlConfig));
        return { resolved: 0 };
      }
      const fetcher = this.fetcherFactory.create(crawlConfig);
      const maxUrls = Number(group.settings?.maxUrls) || undefined;
      seeds = await this.resolver.resolveSitemap(group.sitemapUrl, crawlConfig, fetcher, maxUrls);
      if (seeds.length === 0) {
        await this.crawls.setStatus(crawlId, CrawlStatus.Completed, {
          error: `The sitemap ${group.sitemapUrl} returned no URLs.`,
        });
        await this.state.init(crawlId, 0, serializeConfig(crawlConfig));
        return { resolved: 0 };
      }
      this.logger.log(
        `crawl ${crawlId}: category "${group.name}" — ${seeds.length} URLs from ${group.sitemapUrl}`,
      );
    } else {
      const fetcher = this.fetcherFactory.create(crawlConfig);
      seeds = await this.resolver.resolve(crawl.websiteId, crawlConfig, fetcher);

      // Domain-crawl fallback: with no resolvable sources, crawl the website's
      // homepage and discover its internal links (bounded by depth/page limits).
      // This makes "add a website → start crawl" work without a sitemap.
      if (seeds.length === 0) {
        const origin = normalizeUrl(website.origin);
        if (origin) {
          seeds = [{ url: origin, allowDiscovery: true }];
          this.logger.log(`crawl ${crawlId}: no sources resolved; domain crawl from ${origin}`);
        }
      }
      if (seeds.length === 0) {
        await this.crawls.setStatus(crawlId, CrawlStatus.Completed, {
          error: 'No URLs to crawl. Add a sitemap or URL list under Sources, or check the origin.',
        });
        await this.state.init(crawlId, 0, serializeConfig(crawlConfig));
        return { resolved: 0 };
      }
    }

    // Register pages (bulk upsert), then map normalized URL → page id.
    const pageRefs = await this.pages.upsertMany(
      crawl.websiteId,
      seeds.map((s) => ({ url: s.url, urlHash: urlHash(s.url) })),
    );
    const pageIdByUrl = new Map(pageRefs.map((p) => [p.url, p.id]));

    // Record which pages belong to this category, carrying the sitemap's lastmod.
    // Membership is many-to-many: the same URL may appear in several sitemaps.
    if (crawl.sitemapGroupId) {
      await this.groups.linkPages(
        crawl.sitemapGroupId,
        seeds
          .map((s) => ({ pageId: pageIdByUrl.get(s.url), lastmod: s.lastmod ?? null }))
          .filter((p): p is { pageId: string; lastmod: Date | null } => !!p.pageId),
      );
    }

    // Incremental baseline: conditional hints from the previous completed crawl.
    const hintsByPage = new Map<string, PageFetchJobData['previous']>();
    if (crawl.mode === 'incremental') {
      const previous = await this.crawls.findPreviousCompleted(
        crawl.websiteId,
        crawlId,
        crawl.sitemapGroupId,
      );
      if (previous) {
        for (const h of await this.snapshots.loadConditionalHints(previous.id)) {
          hintsByPage.set(h.pageId, {
            crawlId: previous.id,
            snapshotId: h.snapshotId,
            etag: h.etag ?? undefined,
            lastModified: h.lastModified ?? undefined,
            contentHash: h.contentHash ? h.contentHash.toString('hex') : undefined,
          });
        }
      }
    }

    await this.state.init(crawlId, seeds.length, serializeConfig(crawlConfig));
    await this.crawls.setStatus(crawlId, CrawlStatus.Running);
    await this.crawls.updateStats(crawlId, {
      total: seeds.length,
      crawled: 0,
      unchanged: 0,
      failed: 0,
    });

    const priority = crawl.trigger === 'scheduled' ? 20 : 5;
    const jobs: PageFetchJobData[] = [];
    for (const seed of seeds) {
      const pageId = pageIdByUrl.get(seed.url);
      if (!pageId) continue;
      await this.state.markSeen(crawlId, urlHash(seed.url).toString('hex'));
      jobs.push({
        crawlId,
        websiteId: crawl.websiteId,
        pageId,
        url: seed.url,
        depth: 0,
        discover: seed.allowDiscovery,
        previous: hintsByPage.get(pageId),
      });
    }
    await this.producer.enqueuePageFetch(jobs, priority);

    this.logger.log(
      `crawl ${crawlId} orchestrated: ${jobs.length} pages, mode=${crawl.mode}, engine=${ENGINE_VERSION}`,
    );
    return { resolved: jobs.length };
  }
}
