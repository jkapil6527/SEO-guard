import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { LinkChecksRepository, WebsitesRepository } from '@seo-guardian/db';
import type { LinkCheckInput } from '@seo-guardian/db';
import { registrableDomain, urlHash } from '@seo-guardian/crawler-core';
import { QUEUES } from '@seo-guardian/shared';
import type { LinkCheckJobData } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import type { Env } from '../config/env';
import { resolveCrawlConfig } from '../crawl/crawl-config';
import { FetcherFactory } from '../crawl/fetcher.factory';
import { CrawlStateService } from '../infra/crawl-state.service';
import { PolitenessService } from '../infra/politeness.service';

/**
 * Verifies a batch of unique outbound link targets with HEAD (GET fallback),
 * subject to the same per-domain politeness. Results persist once per crawl and
 * are joined back into per-page broken-link issues by the finalizer.
 */
@Processor(QUEUES.LINK_CHECK, {
  concurrency: Number(process.env.LINK_CHECK_CONCURRENCY ?? 6),
})
export class LinkCheckProcessor extends WorkerHost {
  constructor(
    private readonly linkChecks: LinkChecksRepository,
    private readonly websites: WebsitesRepository,
    private readonly fetcherFactory: FetcherFactory,
    private readonly politeness: PolitenessService,
    private readonly state: CrawlStateService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  override async process(job: Job<LinkCheckJobData>): Promise<unknown> {
    const { crawlId, websiteId, urls } = job.data;
    const website = await this.websites.findById(websiteId);
    if (!website) {
      await this.state.decrLinkBatches(crawlId);
      return { checked: 0 };
    }

    const crawlConfig = resolveCrawlConfig(website.settings, {
      userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
      ratePerSec: this.config.get('DEFAULT_DOMAIN_RATE_PER_SEC', { infer: true }),
      domainConcurrency: this.config.get('DEFAULT_DOMAIN_CONCURRENCY', { infer: true }),
    });
    const fetcher = this.fetcherFactory.create(crawlConfig);
    const originDomain = safeDomain(website.origin);

    const results: LinkCheckInput[] = [];
    for (const url of urls) {
      const domain = safeDomain(url);
      // Best-effort politeness; link checks are low priority and don't retry-loop.
      await this.politeness.acquire(domain, crawlConfig.ratePerSec).catch(() => undefined);

      let res = await fetcher.fetch(url, { method: 'HEAD' });
      // Some servers reject HEAD; retry with GET before declaring broken.
      if (res.status === 405 || res.status === 501 || (res.status === 0 && res.error)) {
        res = await fetcher.fetch(url, { method: 'GET' });
      }
      const ok = res.ok || (res.status >= 200 && res.status < 400);
      results.push({
        url,
        urlHash: urlHash(url),
        status: res.status || null,
        ok,
        isInternal: domain === originDomain,
        redirectHops: res.redirectChain.length,
        error: res.error?.code ?? null,
      });
    }

    await this.linkChecks.insertMany(crawlId, websiteId, results);
    await this.state.decrLinkBatches(crawlId);
    return { checked: results.length, broken: results.filter((r) => !r.ok).length };
  }
}

function safeDomain(url: string): string {
  try {
    return registrableDomain(new URL(url).host);
  } catch {
    return 'unknown';
  }
}
