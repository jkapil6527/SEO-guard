import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUES } from '@seo-guardian/shared';
import type { PageFetchJobData } from '@seo-guardian/shared';
import { DelayedError } from 'bullmq';
import type { Job } from 'bullmq';
import type { Env } from '../config/env';
import { deserializeConfig, resolveCrawlConfig } from '../crawl/crawl-config';
import { BrowserPoolService } from '../crawl/browser-pool.service';
import { FetcherFactory } from '../crawl/fetcher.factory';
import { PageProcessorService, RateLimitedError } from '../crawl/page-processor.service';
import { CrawlStateService } from '../infra/crawl-state.service';

/**
 * JavaScript render path. Re-fetches through the SSRF-guarded fetcher (to
 * validate the target and capture headers/redirects), renders the validated
 * final URL with Playwright, then runs the same validate-and-persist path.
 * Falls back to the static body when rendering fails.
 */
@Processor(QUEUES.PAGE_RENDER, {
  concurrency: Number(process.env.RENDER_CONCURRENCY ?? 2),
})
export class PageRenderProcessor extends WorkerHost {
  constructor(
    private readonly pageProcessor: PageProcessorService,
    private readonly fetcherFactory: FetcherFactory,
    private readonly browserPool: BrowserPoolService,
    private readonly state: CrawlStateService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  override async process(job: Job<PageFetchJobData>, token?: string): Promise<unknown> {
    const data = job.data;
    try {
      if (await this.state.isCancelled(data.crawlId)) return { skipped: true };

      const crawlConfig = deserializeConfig(
        await this.state.getConfig(data.crawlId),
        resolveCrawlConfig(
          {},
          {
            userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
            ratePerSec: this.config.get('DEFAULT_DOMAIN_RATE_PER_SEC', { infer: true }),
            domainConcurrency: this.config.get('DEFAULT_DOMAIN_CONCURRENCY', { infer: true }),
          },
        ),
      );

      const fetcher = this.fetcherFactory.create(crawlConfig);
      const result = await fetcher.fetch(data.url);
      if (result.error || !result.body) {
        const outcome = await this.pageProcessor.processRendered(data, '', result);
        await this.pageProcessor.finishPage(data, outcome.outcome);
        return outcome;
      }

      const rendered = await this.browserPool.render(
        result.finalUrl,
        crawlConfig.userAgent,
        crawlConfig.timeoutMs,
      );
      const html = rendered ?? result.body.toString('utf8');
      const outcome = await this.pageProcessor.processRendered(data, html, result);
      await this.pageProcessor.finishPage(data, outcome.outcome);
      return { ...outcome, rendered: rendered !== null };
    } catch (err) {
      if (err instanceof RateLimitedError) {
        await job.moveToDelayed(Date.now() + err.retryInMs, token);
        throw new DelayedError();
      }
      throw err;
    }
  }
}
