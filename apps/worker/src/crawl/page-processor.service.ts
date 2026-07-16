import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CrawlsRepository,
  PageSnapshotsRepository,
  PagesRepository,
  SchemaEntitiesRepository,
} from '@seo-guardian/db';
import type { IssueInput, SchemaEntityInput, SnapshotInput } from '@seo-guardian/db';
import { normalizeUrl, urlHash, UrlFilter } from '@seo-guardian/crawler-core';
import type { FetchResult } from '@seo-guardian/crawler-core';
import {
  CHECK_IDS,
  computePageScore,
  extractArtifacts,
  getCheck,
  runChecks,
} from '@seo-guardian/seo-engine';
import type { PageArtifacts, PageContext, RuleResult } from '@seo-guardian/seo-engine';
import { validatePageSchema } from '@seo-guardian/schema-engine';
import type { SchemaPageResult } from '@seo-guardian/schema-engine';
import { CrawlStatus, IssueSeverity } from '@seo-guardian/shared';
import type { PageFetchJobData } from '@seo-guardian/shared';
import type { Env } from '../config/env';
import { deserializeConfig, resolveCrawlConfig } from './crawl-config';
import type { CrawlConfig } from './crawl-config';
import { CrawlProducerService } from './crawl-producer.service';
import { FetcherFactory } from './fetcher.factory';
import { CrawlStateService } from '../infra/crawl-state.service';
import { HtmlStorageService } from '../infra/html-storage.service';
import { PolitenessService } from '../infra/politeness.service';

export interface PageProcessOutcome {
  outcome: 'crawled' | 'unchanged' | 'failed';
  /** True when the page was handed to the render queue; the render path owns progress. */
  routedToRender?: boolean;
}

/** Signals that BullMQ should delay-retry the job (politeness backpressure). */
export class RateLimitedError extends Error {
  constructor(readonly retryInMs: number) {
    super('rate limited');
  }
}

/**
 * Processes one page end to end: politeness gate, conditional fetch, optional
 * render, artifact extraction, SEO validation, idempotent persistence,
 * discovery expansion, progress publication, and completion detection.
 * Shared by the fetch and render processors.
 */
@Injectable()
export class PageProcessorService {
  private readonly logger = new Logger(PageProcessorService.name);

  constructor(
    private readonly crawls: CrawlsRepository,
    private readonly pages: PagesRepository,
    private readonly snapshots: PageSnapshotsRepository,
    private readonly schemaEntities: SchemaEntitiesRepository,
    private readonly producer: CrawlProducerService,
    private readonly fetcherFactory: FetcherFactory,
    private readonly storage: HtmlStorageService,
    private readonly politeness: PolitenessService,
    private readonly state: CrawlStateService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Entry point for the static fetch path. */
  async processFetch(data: PageFetchJobData): Promise<PageProcessOutcome> {
    if (await this.shouldSkip(data.crawlId)) return { outcome: 'unchanged' };
    const config = await this.loadConfig(data);
    const fetcher = this.fetcherFactory.create(config);

    await this.gatePoliteness(data.url, config);

    const result = await fetcher.fetch(data.url, {
      etag: data.previous?.etag,
      lastModified: data.previous?.lastModified,
    });

    if (result.notModified && data.previous) {
      return this.carryForward(data);
    }
    // Transport failure, empty body, or an HTTP error status → error snapshot.
    if (result.error || !result.body || result.status >= 400) {
      return this.persistFetchError(data, result);
    }

    const html = result.body.toString('utf8');
    if (
      config.renderPolicy === 'always' ||
      (config.renderPolicy === 'auto' && this.needsRender(html))
    ) {
      await this.producer.enqueueRender(data, 5);
      return { outcome: 'unchanged', routedToRender: true };
    }

    return this.validateAndPersist(data, config, result, html, false);
  }

  /** Entry point for the Playwright render path (rendered DOM supplied). */
  async processRendered(
    data: PageFetchJobData,
    renderedHtml: string,
    result: FetchResult,
  ): Promise<PageProcessOutcome> {
    if (await this.shouldSkip(data.crawlId)) return { outcome: 'unchanged' };
    if (result.error || !renderedHtml || result.status >= 400) {
      return this.persistFetchError(data, result);
    }
    const config = await this.loadConfig(data);
    return this.validateAndPersist(data, config, result, renderedHtml, true);
  }

  private async validateAndPersist(
    data: PageFetchJobData,
    config: CrawlConfig,
    result: FetchResult,
    html: string,
    rendered: boolean,
  ): Promise<PageProcessOutcome> {
    const contentHash = createHash('sha256').update(html).digest();
    const contentHashHex = contentHash.toString('hex');

    // Unchanged by content hash (incremental): carry forward without re-validating.
    if (data.previous?.contentHash === contentHashHex) {
      return this.carryForward(data);
    }

    await this.storage.put('raw', contentHashHex, Buffer.from(html, 'utf8')).catch((err) => {
      this.logger.warn({ err, url: data.url }, 'raw html store failed (continuing)');
    });

    const ctx: PageContext = {
      url: data.url,
      finalUrl: result.finalUrl,
      httpStatus: result.status,
      headers: result.headers,
      redirectChain: result.redirectChain,
      rendered,
    };
    const artifacts = extractArtifacts(html, ctx);
    const ruleResults = runChecks(artifacts, { origin: originOf(data.url), pathScope: '/' });
    const score = computePageScore(ruleResults);
    const issues = this.toIssues(ruleResults);
    const issueCounts = countBySeverity(ruleResults);

    // Schema.org extraction + validation (JSON-LD / Microdata / RDFa).
    const schema = validatePageSchema(html, {
      url: data.url,
      finalUrl: result.finalUrl,
      headers: result.headers,
    });
    const schemaEntities = this.toSchemaEntities(schema);

    const fetchStatus: SnapshotInput['fetchStatus'] =
      result.redirectChain.length > 0 ? 'redirected' : 'ok';

    await this.snapshots.replaceSnapshot(
      {
        crawlId: data.crawlId,
        pageId: data.pageId,
        websiteId: data.websiteId,
        fetchStatus,
        httpStatus: result.status,
        redirectChain: result.redirectChain.length > 0 ? result.redirectChain : null,
        contentHash,
        artifacts: {
          ...artifacts,
          etag: artifacts.etag,
          lastModified: artifacts.lastModified,
          schemaSummary: schemaSummary(schema),
        },
        score,
        issueCounts,
        timingMs: { fetch: result.timings.totalMs },
        rendered,
      },
      issues,
      schemaEntities,
    );

    await this.enqueueLinkTargets(data, artifacts);
    // Only spider onward when this page participates in discovery (domain /
    // discovery crawls). List sources (manual, CSV, sitemap) crawl exactly their
    // URLs, so a single specific page stays a single page.
    if (data.discover) {
      await this.expandDiscovery(data, config, artifacts);
    }

    return { outcome: 'crawled' };
  }

  /**
   * A page unchanged since the previous crawl: create a new snapshot marked
   * carried_forward that inherits the prior artifacts/score, and copy its issues
   * so history and diffs stay complete without re-fetching or re-validating.
   */
  private async carryForward(data: PageFetchJobData): Promise<PageProcessOutcome> {
    const previous = data.previous;
    if (!previous) return { outcome: 'unchanged' };
    const prior = await this.snapshots.findByCrawlAndPage(previous.crawlId, data.pageId);

    const { id } = await this.snapshots.replaceSnapshot(
      {
        crawlId: data.crawlId,
        pageId: data.pageId,
        websiteId: data.websiteId,
        fetchStatus: 'carried_forward',
        httpStatus: prior?.httpStatus ?? 304,
        redirectChain: null,
        contentHash: previous.contentHash ? Buffer.from(previous.contentHash, 'hex') : null,
        artifacts: prior?.artifacts ?? null,
        score: prior?.score != null ? Number(prior.score) : null,
        issueCounts: prior?.issueCounts ?? {},
        timingMs: null,
        rendered: prior?.rendered ?? false,
      },
      [],
    );
    if (prior) {
      const to = {
        crawlId: data.crawlId,
        snapshotId: id,
        pageId: data.pageId,
        websiteId: data.websiteId,
      };
      await this.snapshots.copyIssues(previous.crawlId, prior.id, to);
      await this.schemaEntities.copyForCarryForward(previous.crawlId, prior.id, to);
    }
    return { outcome: 'unchanged' };
  }

  private async persistFetchError(
    data: PageFetchJobData,
    result: FetchResult,
  ): Promise<PageProcessOutcome> {
    await this.snapshots.replaceSnapshot(
      {
        crawlId: data.crawlId,
        pageId: data.pageId,
        websiteId: data.websiteId,
        fetchStatus: 'error',
        httpStatus: result.status || null,
        redirectChain: result.redirectChain.length > 0 ? result.redirectChain : null,
        contentHash: null,
        artifacts: null,
        score: 0,
        issueCounts: { critical: 1 },
        timingMs: { fetch: result.timings.totalMs },
        rendered: false,
      },
      [
        {
          checkId: result.status >= 400 ? CHECK_IDS.STATUS_ERROR : CHECK_IDS.FETCH_FAILED,
          severity: IssueSeverity.Critical,
          fingerprint: createHash('sha256').update(`${data.pageId}:fetch-error`).digest(),
          evidence: {
            status: result.status,
            error: result.error?.code ?? null,
            message: result.error?.message ?? null,
          },
        },
      ],
    );
    return { outcome: 'failed' };
  }

  /** Records progress and, when the crawl's pages have all settled, triggers finalize. */
  async finishPage(data: PageFetchJobData, outcome: PageProcessOutcome['outcome']): Promise<void> {
    const counters = await this.state.recordPage(data.crawlId, outcome, data.url);
    await this.state.publish(this.state.buildProgress(data.crawlId, CrawlStatus.Running, counters));
    if (this.state.isComplete(counters)) {
      await this.crawls.updateStats(data.crawlId, {
        total: counters.total,
        crawled: counters.crawled,
        unchanged: counters.unchanged,
        failed: counters.failed,
      });
      await this.producer.enqueueFinalize({ crawlId: data.crawlId, reason: 'completed' });
    }
  }

  private async enqueueLinkTargets(
    data: PageFetchJobData,
    artifacts: PageArtifacts,
  ): Promise<void> {
    // Image sources are verified alongside anchor hrefs — otherwise a broken
    // <img> is undetectable and images.src.broken can never fire. Skip empty
    // srcs (an image with neither src nor a lazy-load attribute) so we never
    // enqueue an empty target and report it as a broken image.
    const imageSrcs = artifacts.images.map((i) => i.src).filter((src) => src.length > 0);
    const targets = [...new Set([...artifacts.links.map((l) => l.href), ...imageSrcs])];
    const fresh = await this.state.markLinkTargetsNew(data.crawlId, targets);
    const BATCH = 100;
    const batches: string[][] = [];
    for (let i = 0; i < fresh.length; i += BATCH) batches.push(fresh.slice(i, i + BATCH));
    if (batches.length > 0) {
      // Track outstanding batches so finalize waits for link verification to drain.
      await this.state.incrLinkBatches(data.crawlId, batches.length);
      for (const urls of batches) {
        await this.producer.enqueueLinkCheck({
          crawlId: data.crawlId,
          websiteId: data.websiteId,
          urls,
        });
      }
    }
  }

  private async expandDiscovery(
    data: PageFetchJobData,
    config: CrawlConfig,
    artifacts: PageArtifacts,
  ): Promise<void> {
    if (data.depth >= config.discoveryMaxDepth) return;
    const website = originOf(data.url);
    const filter = new UrlFilter({
      origin: website,
      pathScope: '/',
      allow: config.allow,
      block: config.block,
    });
    const internal = artifacts.links.filter(
      (l) => l.internal && filter.classify(l.href) === 'in_scope',
    );

    const newJobs: PageFetchJobData[] = [];
    for (const link of internal) {
      const normalized = normalizeUrl(link.href);
      if (!normalized) continue;
      const hashHex = urlHash(normalized).toString('hex');
      if (!(await this.state.markSeen(data.crawlId, hashHex))) continue;
      const page = await this.pages.upsertOne(data.websiteId, normalized, urlHash(normalized));
      newJobs.push({
        crawlId: data.crawlId,
        websiteId: data.websiteId,
        pageId: page.id,
        url: normalized,
        depth: data.depth + 1,
        discover: true,
      });
    }
    if (newJobs.length > 0) {
      await this.state.addToTotal(data.crawlId, newJobs.length);
      await this.producer.enqueuePageFetch(newJobs, 5);
    }
  }

  private async gatePoliteness(url: string, config: CrawlConfig): Promise<void> {
    const domain = registrableDomainOf(url);
    const { allowed, retryInMs } = await this.politeness.acquire(domain, config.ratePerSec);
    if (!allowed) throw new RateLimitedError(retryInMs);
  }

  private async shouldSkip(crawlId: string): Promise<boolean> {
    if (await this.state.isCancelled(crawlId)) return true;
    if (await this.state.isPaused(crawlId)) throw new RateLimitedError(2000);
    return false;
  }

  private async loadConfig(data: PageFetchJobData): Promise<CrawlConfig> {
    const raw = await this.state.getConfig(data.crawlId);
    const fallback = resolveCrawlConfig(
      {},
      {
        userAgent: this.config.get('CRAWLER_USER_AGENT', { infer: true }),
        ratePerSec: this.config.get('DEFAULT_DOMAIN_RATE_PER_SEC', { infer: true }),
        domainConcurrency: this.config.get('DEFAULT_DOMAIN_CONCURRENCY', { infer: true }),
      },
    );
    return deserializeConfig(raw, fallback);
  }

  /** Heuristic: server-rendered pages expose content; near-empty body root ⇒ needs JS. */
  private needsRender(html: string): boolean {
    const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
    const body = bodyMatch?.[1] ?? html;
    const text = body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .trim();
    const hasAppRoot = /<div[^>]+id=["'](root|app|__next)["']/i.test(html);
    return hasAppRoot && text.length < 200;
  }

  private toIssues(results: RuleResult[]): IssueInput[] {
    return results.map((r) => ({
      checkId: r.ruleId,
      severity: r.severity,
      fingerprint: createHash('sha256')
        .update(`${r.ruleId}:${r.affectedElement ?? ''}:${r.message}`)
        .digest(),
      evidence: {
        message: r.message,
        technicalExplanation: r.technicalExplanation,
        suggestedFix: r.suggestedFix,
        affectedElement: r.affectedElement ?? null,
        weight: getCheck(r.ruleId)?.weight ?? null,
        ...r.metadata,
      },
    }));
  }

  /** Maps schema-engine output to persistable entity rows (one per top-level entity). */
  private toSchemaEntities(schema: SchemaPageResult): SchemaEntityInput[] {
    return schema.entities.map((entity, i) => {
      const validation = schema.validations[i];
      const rich = schema.richResults[i];
      return {
        format: entity.format,
        schemaType: entity.type || 'Unknown',
        status: validation?.status ?? 'valid',
        identity: entity.identity,
        properties: entity.properties,
        validation: validation
          ? {
              results: validation.results,
              missingRequired: validation.missingRequired,
              missingRecommended: validation.missingRecommended,
              invalidProperties: validation.invalidProperties,
              deprecatedProperties: validation.deprecatedProperties,
              requiredProperties: validation.requiredProperties,
              recommendedProperties: validation.recommendedProperties,
              detectedProperties: validation.detectedProperties,
            }
          : {},
        richResults: rich?.verdicts ?? [],
        entityHash: Buffer.from(entity.entityHash, 'hex'),
        confidence: validation?.confidence ?? 1,
      };
    });
  }
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function registrableDomainOf(url: string): string {
  try {
    const host = new URL(url).host;
    return host.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function countBySeverity(results: RuleResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.severity] = (counts[r.severity] ?? 0) + 1;
  return counts;
}

/** Compact per-page schema rollup stored on the snapshot artifacts for fast reads. */
function schemaSummary(schema: SchemaPageResult): Record<string, unknown> {
  return {
    entityCount: schema.coverage.entityCount,
    types: Object.keys(schema.coverage.typeCounts),
    richEligible: schema.coverage.richEligibleCount,
    errors: schema.coverage.errorCount,
    warnings: schema.coverage.warningCount,
    invalidJson: schema.coverage.invalidJsonCount,
  };
}
