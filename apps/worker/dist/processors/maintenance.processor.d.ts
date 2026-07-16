import { WorkerHost } from '@nestjs/bullmq';
import { CrawlsRepository } from '@seo-guardian/db';
import type { Job } from 'bullmq';
import { CrawlProducerService } from '../crawl/crawl-producer.service';
import { PartitionService } from '../services/partition.service';
import { SchedulerSyncService } from '../services/scheduler-sync.service';
export declare class MaintenanceProcessor extends WorkerHost {
    private readonly partitions;
    private readonly schedulerSync;
    private readonly crawls;
    private readonly producer;
    private readonly logger;
    constructor(partitions: PartitionService, schedulerSync: SchedulerSyncService, crawls: CrawlsRepository, producer: CrawlProducerService);
    process(job: Job): Promise<unknown>;
    /**
     * Recover crawls whose finalize died and left them frozen in 'finalizing'
     * (or 'running' at 100%). BullMQ marks a finalize job "stalled" when the
     * worker can't renew its lock — most often because it was interrupted
     * mid-run — and once the stall retries are exhausted the job fails with no
     * one to re-drive it. This sweep re-enqueues finalize (which is idempotent)
     * for each such crawl.
     */
    private reapStuckCrawls;
}
