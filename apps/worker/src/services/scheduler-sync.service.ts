import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { SchedulesRepository } from '@seo-guardian/db';
import { QUEUES } from '@seo-guardian/shared';
import type { ScheduleFireJobData } from '@seo-guardian/shared';
import type { Queue } from 'bullmq';

/**
 * The schedules table is the source of truth; BullMQ job schedulers are a
 * projection of it. This service converges the projection: one scheduler per
 * active schedule row (id = schedule id), stale schedulers removed. Runs on
 * boot, hourly, and on demand when the API mutates schedules.
 */
@Injectable()
export class SchedulerSyncService {
  private readonly logger = new Logger(SchedulerSyncService.name);

  constructor(
    @InjectQueue(QUEUES.SCHEDULE_FIRE) private readonly scheduleQueue: Queue,
    private readonly schedules: SchedulesRepository,
  ) {}

  async reconcile(): Promise<{ upserted: number; removed: number }> {
    const active = await this.schedules.listAllActive();
    const activeIds = new Set(active.map((s) => s.id));

    let upserted = 0;
    for (const schedule of active) {
      const data: ScheduleFireJobData = {
        scheduleId: schedule.id,
        websiteId: schedule.websiteId,
      };
      await this.scheduleQueue.upsertJobScheduler(
        schedule.id,
        { pattern: schedule.cron, tz: schedule.timezone },
        {
          name: 'fire',
          data,
          opts: { removeOnComplete: { age: 24 * 3600 }, removeOnFail: { age: 7 * 24 * 3600 } },
        },
      );
      upserted += 1;
    }

    let removed = 0;
    const existing = await this.scheduleQueue.getJobSchedulers(0, -1);
    for (const scheduler of existing) {
      if (scheduler.key && !activeIds.has(scheduler.key)) {
        await this.scheduleQueue.removeJobScheduler(scheduler.key);
        removed += 1;
      }
    }

    this.logger.log(`schedule reconcile: ${upserted} upserted, ${removed} removed`);
    return { upserted, removed };
  }
}
