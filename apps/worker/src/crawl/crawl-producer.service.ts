import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { DEFAULT_JOB_OPTIONS, QUEUES } from '@seo-guardian/shared';
import type {
  FinalizeJobData,
  LinkCheckJobData,
  OrchestrateJobData,
  PageFetchJobData,
} from '@seo-guardian/shared';
import type { Queue } from 'bullmq';

/**
 * Single writer for all crawl-related queues. Page jobs carry a per-domain
 * group key so BullMQ's group concurrency enforces politeness independently of
 * worker count (docs/05 §1).
 */
@Injectable()
export class CrawlProducerService {
  constructor(
    @InjectQueue(QUEUES.CRAWL_ORCHESTRATE) private readonly orchestrateQueue: Queue,
    @InjectQueue(QUEUES.PAGE_FETCH) private readonly fetchQueue: Queue,
    @InjectQueue(QUEUES.PAGE_RENDER) private readonly renderQueue: Queue,
    @InjectQueue(QUEUES.LINK_CHECK) private readonly linkQueue: Queue,
    @InjectQueue(QUEUES.CRAWL_FINALIZE) private readonly finalizeQueue: Queue,
  ) {}

  enqueueOrchestrate(data: OrchestrateJobData, priority: number): Promise<unknown> {
    return this.orchestrateQueue.add('orchestrate', data, { ...DEFAULT_JOB_OPTIONS, priority });
  }

  async enqueuePageFetch(jobs: PageFetchJobData[], priority: number): Promise<void> {
    if (jobs.length === 0) return;
    // Per-domain politeness is enforced at processing time by PolitenessService
    // (Redis rate limiter + delay-retry), which holds regardless of worker count.
    await this.fetchQueue.addBulk(
      jobs.map((data) => ({
        name: 'fetch',
        data,
        opts: { ...DEFAULT_JOB_OPTIONS, priority, jobId: `${data.crawlId}_${data.pageId}` },
      })),
    );
  }

  enqueueRender(data: PageFetchJobData, priority: number): Promise<unknown> {
    return this.renderQueue.add('render', data, {
      ...DEFAULT_JOB_OPTIONS,
      priority,
      jobId: `render_${data.crawlId}_${data.pageId}`,
    });
  }

  enqueueLinkCheck(data: LinkCheckJobData): Promise<unknown> {
    return this.linkQueue.add('link-check', data, { ...DEFAULT_JOB_OPTIONS, priority: 10 });
  }

  enqueueFinalize(data: FinalizeJobData): Promise<unknown> {
    return this.finalizeQueue.add('finalize', data, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 1,
      jobId: `finalize_${data.crawlId}`,
      // Collapse repeated completion signals into a single finalize.
      deduplication: { id: `finalize_${data.crawlId}` },
    });
  }

  /**
   * Re-drive finalize for a stuck crawl. The fixed jobId + deduplication that
   * collapse duplicate completion signals also mean a *failed* finalize job
   * lingers under that id and silently blocks any re-enqueue — so a crawl whose
   * finalize died (e.g. the worker was interrupted mid-run) can never recover on
   * its own. Clear the stale job and its dedup key first, then enqueue fresh.
   * Genuinely in-flight jobs (waiting/active/delayed) are left untouched.
   *
   * Returns true if a fresh finalize was enqueued.
   */
  async redriveFinalize(crawlId: string): Promise<boolean> {
    const jobId = `finalize_${crawlId}`;
    const existing = await this.finalizeQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        return false;
      }
      await existing.remove();
    }
    await this.finalizeQueue.removeDeduplicationKey(jobId);
    await this.enqueueFinalize({ crawlId, reason: 'watchdog' });
    return true;
  }
}
