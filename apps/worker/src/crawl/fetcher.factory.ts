import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SafeFetcher } from '@seo-guardian/crawler-core';
import type { Env } from '../config/env';
import type { CrawlConfig } from './crawl-config';

/**
 * Builds SSRF-guarded fetchers. In tests, CRAWLER_ALLOW_PRIVATE_TARGETS lets
 * the guard reach a localhost fixture server; in production it is empty, so
 * private address space stays blocked.
 */
@Injectable()
export class FetcherFactory {
  private readonly allowPrivateTargets: string[];

  constructor(private readonly config: ConfigService<Env, true>) {
    this.allowPrivateTargets = config
      .get('CRAWLER_ALLOW_PRIVATE_TARGETS', { infer: true })
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  create(crawlConfig: CrawlConfig): SafeFetcher {
    return new SafeFetcher({
      userAgent: crawlConfig.userAgent,
      timeoutMs: crawlConfig.timeoutMs,
      maxRedirects: crawlConfig.maxRedirects,
      allowPrivateTargets: this.allowPrivateTargets,
    });
  }
}
