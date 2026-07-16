import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CrawlsRepository } from '@seo-guardian/db';
import { MAINTENANCE_JOBS, QUEUES } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import { CrawlProducerService } from '../crawl/crawl-producer.service';
import { PartitionService } from '../services/partition.service';
import { SchedulerSyncService } from '../services/scheduler-sync.service';

/**
 * A finalize job that started less than this ago might still be legitimately
 * running (heavy cross-page SQL), so the reaper leaves it alone. Older than this
 * and stuck → its finalize died and needs re-driving.
 */
const STUCK_AFTER_MS = 3 * 60 * 1000;

@Processor(QUEUES.MAINTENANCE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly partitions: PartitionService,
    private readonly schedulerSync: SchedulerSyncService,
    private readonly crawls: CrawlsRepository,
    private readonly producer: CrawlProducerService,
  ) {
    super();
  }

  override async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case MAINTENANCE_JOBS.ENSURE_PARTITIONS:
        return { created: await this.partitions.ensurePartitions() };
      case MAINTENANCE_JOBS.RECONCILE_SCHEDULES:
        return this.schedulerSync.reconcile();
      case MAINTENANCE_JOBS.REAP_STUCK_CRAWLS:
        return this.reapStuckCrawls();
      default:
        this.logger.warn(`unknown maintenance job '${job.name}' — dropping`);
        return null;
    }
  }

  /**
   * Recover crawls whose finalize died and left them frozen in 'finalizing'
   * (or 'running' at 100%). BullMQ marks a finalize job "stalled" when the
   * worker can't renew its lock — most often because it was interrupted
   * mid-run — and once the stall retries are exhausted the job fails with no
   * one to re-drive it. This sweep re-enqueues finalize (which is idempotent)
   * for each such crawl.
   */
  private async reapStuckCrawls(): Promise<{ reaped: number }> {
    const stuck = await this.crawls.findStuckFinalizing(new Date(Date.now() - STUCK_AFTER_MS));
    let reaped = 0;
    for (const crawl of stuck) {
      const enqueued = await this.producer.redriveFinalize(crawl.id);
      if (enqueued) {
        reaped += 1;
        this.logger.warn(`re-driving stuck finalize for crawl ${crawl.id} (was ${crawl.status})`);
      }
    }
    if (reaped > 0) this.logger.log(`reaped ${reaped} stuck crawl(s)`);
    return { reaped };
  }
}
