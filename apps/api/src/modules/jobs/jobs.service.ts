import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_JOB_OPTIONS, MAINTENANCE_JOBS, QUEUES } from '@seo-guardian/shared';
import type { Queue } from 'bullmq';

/**
 * Facade for everything the API enqueues. Queue unavailability is logged and
 * swallowed for advisory jobs (the worker reconciles on its own timer), so a
 * Redis blip never fails a user mutation.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(@InjectQueue(QUEUES.MAINTENANCE) private readonly maintenance: Queue) {}

  /** Ask the worker to re-sync BullMQ job schedulers with the schedules table now. */
  async requestScheduleReconcile(): Promise<void> {
    try {
      await this.maintenance.add(
        MAINTENANCE_JOBS.RECONCILE_SCHEDULES,
        {},
        {
          ...DEFAULT_JOB_OPTIONS,
          // Collapse bursts of schedule edits into one pending reconcile.
          deduplication: { id: MAINTENANCE_JOBS.RECONCILE_SCHEDULES },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (err) {
      this.logger.warn(
        { err },
        'could not enqueue schedule reconcile; worker will reconcile on its hourly timer',
      );
    }
  }

  /**
   * Readiness probe support. `queue.client` resolves only once the connection
   * is READY, so it must be raced against a timeout — a probe may never hang.
   */
  async pingQueues(timeoutMs = 2_000): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('redis ping timeout')), timeoutMs);
    });
    try {
      const client = (await Promise.race([this.maintenance.client, timeout])) as unknown as {
        ping(): Promise<string>;
      };
      await Promise.race([client.ping(), timeout]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
