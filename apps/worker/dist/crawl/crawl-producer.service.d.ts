import type { FinalizeJobData, LinkCheckJobData, OrchestrateJobData, PageFetchJobData } from '@seo-guardian/shared';
import type { Queue } from 'bullmq';
/**
 * Single writer for all crawl-related queues. Page jobs carry a per-domain
 * group key so BullMQ's group concurrency enforces politeness independently of
 * worker count (docs/05 §1).
 */
export declare class CrawlProducerService {
    private readonly orchestrateQueue;
    private readonly fetchQueue;
    private readonly renderQueue;
    private readonly linkQueue;
    private readonly finalizeQueue;
    constructor(orchestrateQueue: Queue, fetchQueue: Queue, renderQueue: Queue, linkQueue: Queue, finalizeQueue: Queue);
    enqueueOrchestrate(data: OrchestrateJobData, priority: number): Promise<unknown>;
    enqueuePageFetch(jobs: PageFetchJobData[], priority: number): Promise<void>;
    enqueueRender(data: PageFetchJobData, priority: number): Promise<unknown>;
    enqueueLinkCheck(data: LinkCheckJobData): Promise<unknown>;
    enqueueFinalize(data: FinalizeJobData): Promise<unknown>;
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
    redriveFinalize(crawlId: string): Promise<boolean>;
}
