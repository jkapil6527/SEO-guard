import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrawlsRepository,
  PageIssuesRepository,
  PageSnapshotsRepository,
  WebsitesRepository,
} from '@seo-guardian/db';
import type { CrawlReportRow, CrawlRow } from '@seo-guardian/db';
import { ENGINE_VERSION } from '@seo-guardian/seo-engine';
import {
  CrawlMode,
  CrawlScope,
  CrawlStatus,
  DEFAULT_JOB_OPTIONS,
  ERROR_CODES,
  QUEUES,
} from '@seo-guardian/shared';
import type { OrchestrateJobData } from '@seo-guardian/shared';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CrawlProgressService } from './crawl-progress.service';

interface ActorContext {
  actor: AuthUser;
  ip: string | null;
}

const CONTROLLABLE = new Set([
  CrawlStatus.Queued,
  CrawlStatus.Resolving,
  CrawlStatus.Running,
  CrawlStatus.Paused,
]);

@Injectable()
export class CrawlsService {
  constructor(
    private readonly crawls: CrawlsRepository,
    private readonly websites: WebsitesRepository,
    private readonly snapshots: PageSnapshotsRepository,
    private readonly issues: PageIssuesRepository,
    private readonly progress: CrawlProgressService,
    private readonly audit: AuditService,
    @InjectQueue(QUEUES.CRAWL_ORCHESTRATE) private readonly orchestrateQueue: Queue,
    @InjectQueue(QUEUES.PAGE_FETCH) private readonly fetchQueue: Queue,
  ) {}

  async start(
    websiteId: string,
    mode: CrawlMode,
    scope: CrawlScope,
    url: string | undefined,
    ctx: ActorContext,
    sitemapGroupId?: string,
  ): Promise<CrawlRow> {
    const website = await this.websites.findById(websiteId);
    if (!website) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'website not found' });
    }
    const targetUrl =
      scope === CrawlScope.Page ? this.resolvePageTarget(url, website.origin) : null;
    if (scope === CrawlScope.Group && !sitemapGroupId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'sitemapGroupId is required for a category crawl',
      });
    }

    // Categories are independent, so the guard is scoped to the group. A
    // website-wide crawl still conflicts with everything, since it covers them all.
    const active = await this.crawls.findActiveForScope(websiteId, sitemapGroupId);
    if (active) {
      throw new ConflictException({
        code: ERROR_CODES.CONFLICT,
        message: active.sitemapGroupId
          ? `A crawl is already ${active.status} for this category`
          : `A site-wide crawl is already ${active.status} for this website`,
      });
    }
    const crawl = await this.crawls.create({
      websiteId,
      trigger: 'manual',
      mode,
      scope,
      targetUrl,
      sitemapGroupId: sitemapGroupId ?? null,
      rulePackVersion: ENGINE_VERSION,
      createdBy: ctx.actor.id,
    });
    await this.orchestrateQueue.add(
      'orchestrate',
      { crawlId: crawl.id } satisfies OrchestrateJobData,
      { ...DEFAULT_JOB_OPTIONS, priority: 5 },
    );
    await this.audit.record({
      ...ctx,
      projectId: website.projectId,
      action: 'start',
      entity: 'crawl',
      entityId: crawl.id,
      after: { mode, scope, targetUrl, sitemapGroupId: sitemapGroupId ?? null, trigger: 'manual' },
    });
    return crawl;
  }

  /**
   * A page crawl must stay inside the website it belongs to — otherwise the URL
   * is an arbitrary fetch target chosen by the caller. The worker canonicalizes
   * the URL later; here we only enforce http(s) and a matching origin.
   */
  private resolvePageTarget(url: string | undefined, origin: string): string {
    const reject = (message: string): never => {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message,
        errors: [{ field: 'url', message }],
      });
    };
    if (!url?.trim()) {
      return reject('Enter the page URL to crawl');
    }
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      return reject('Enter a valid http(s) URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return reject('Enter a valid http(s) URL');
    }
    if (parsed.origin !== new URL(origin).origin) {
      return reject(`The URL must be on this website's origin (${origin})`);
    }
    return parsed.toString();
  }

  listAll(limit: number, beforeCreatedAt?: Date, projectId?: string): Promise<CrawlReportRow[]> {
    return this.crawls.listAll(limit, beforeCreatedAt, projectId);
  }

  async getStatus(crawlId: string): Promise<CrawlReportRow & { live: unknown }> {
    const crawl = await this.crawls.findReportById(crawlId);
    if (!crawl) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'crawl not found' });
    }
    const live = await this.progress.snapshot(crawlId);
    return { ...crawl, live };
  }

  history(websiteId: string, limit: number, beforeCreatedAt?: Date): Promise<CrawlRow[]> {
    return this.crawls.listByWebsite(websiteId, limit, beforeCreatedAt);
  }

  async pause(crawlId: string, ctx: ActorContext): Promise<void> {
    const crawl = await this.assertControllable(crawlId);
    await this.progress.setPaused(crawlId, true);
    await this.crawls.setStatus(crawlId, CrawlStatus.Paused);
    await this.recordControl(crawl, 'pause', ctx);
  }

  async resume(crawlId: string, ctx: ActorContext): Promise<void> {
    const crawl = await this.getById(crawlId);
    if (crawl.status !== CrawlStatus.Paused) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: 'crawl is not paused' });
    }
    await this.progress.setPaused(crawlId, false);
    await this.crawls.setStatus(crawlId, CrawlStatus.Running);
    await this.recordControl(crawl, 'resume', ctx);
  }

  async cancel(crawlId: string, ctx: ActorContext): Promise<void> {
    const crawl = await this.assertControllable(crawlId);
    await this.progress.requestCancel(crawlId);
    await this.progress.setPaused(crawlId, false);
    // Workers observe the flag and stop; a terminal status is set by them or the finalizer.
    await this.recordControl(crawl, 'cancel', ctx);
  }

  async retryFailed(crawlId: string, ctx: ActorContext): Promise<{ requeued: number }> {
    const crawl = await this.getById(crawlId);
    const failed = await this.snapshots.listFailedPages(crawlId);
    if (failed.length === 0) return { requeued: 0 };
    await this.fetchQueue.addBulk(
      failed.map((f) => ({
        name: 'fetch',
        data: {
          crawlId,
          websiteId: crawl.websiteId,
          pageId: f.pageId,
          url: f.url,
          depth: 0,
        },
        opts: {
          ...DEFAULT_JOB_OPTIONS,
          priority: 3,
          jobId: `retry_${crawlId}_${f.pageId}_${Date.now()}`,
        },
      })),
    );
    await this.recordControl(crawl, 'retry-failed', ctx);
    return { requeued: failed.length };
  }

  private async assertControllable(crawlId: string): Promise<CrawlRow> {
    const crawl = await this.getById(crawlId);
    if (!CONTROLLABLE.has(crawl.status as CrawlStatus)) {
      throw new ConflictException({
        code: ERROR_CODES.CONFLICT,
        message: `crawl is ${crawl.status} and cannot be controlled`,
      });
    }
    return crawl;
  }

  private async getById(crawlId: string): Promise<CrawlRow> {
    const crawl = await this.crawls.findById(crawlId);
    if (!crawl) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'crawl not found' });
    }
    return crawl;
  }

  private async recordControl(crawl: CrawlRow, action: string, ctx: ActorContext): Promise<void> {
    const projectId = await this.websites.projectIdOf(crawl.websiteId);
    await this.audit.record({
      ...ctx,
      projectId,
      action,
      entity: 'crawl',
      entityId: crawl.id,
    });
  }
}
