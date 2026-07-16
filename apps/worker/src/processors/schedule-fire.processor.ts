import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CrawlsRepository, SchedulesRepository } from '@seo-guardian/db';
import { ENGINE_VERSION } from '@seo-guardian/seo-engine';
import { CrawlScope, QUEUES } from '@seo-guardian/shared';
import type { ScheduleFireJobData } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { CrawlProducerService } from '../crawl/crawl-producer.service';

/**
 * Consumes schedule firings: advances schedule bookkeeping and starts a crawl
 * for the website. Overlap guard skips a firing when a crawl is already active.
 */
@Processor(QUEUES.SCHEDULE_FIRE)
export class ScheduleFireProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduleFireProcessor.name);

  constructor(
    private readonly schedules: SchedulesRepository,
    private readonly crawls: CrawlsRepository,
    private readonly producer: CrawlProducerService,
  ) {
    super();
  }

  override async process(job: Job<ScheduleFireJobData>): Promise<unknown> {
    const { scheduleId, websiteId } = job.data;
    const schedule = await this.schedules.findById(scheduleId);
    if (!schedule || !schedule.isActive) {
      this.logger.warn(`schedule ${scheduleId} no longer active; ignoring firing`);
      return { fired: false };
    }

    await this.schedules.markFired(scheduleId, this.nextRun(schedule.cron, schedule.timezone));

    // Overlap guard: don't stack crawls on a website that is still crawling.
    const active = await this.crawls.findActiveForScope(websiteId);
    if (active) {
      this.logger.warn(
        `website ${websiteId} already crawling (${active.id}); skipping scheduled crawl`,
      );
      return { fired: true, skipped: 'overlap' };
    }

    const crawl = await this.crawls.create({
      websiteId,
      trigger: 'scheduled',
      mode: schedule.mode,
      scope: CrawlScope.Site,
      targetUrl: null,
      rulePackVersion: ENGINE_VERSION,
      createdBy: null,
    });
    await this.producer.enqueueOrchestrate({ crawlId: crawl.id }, 20);
    this.logger.log(
      `scheduled crawl ${crawl.id} started for website ${websiteId} (mode=${schedule.mode})`,
    );
    return { fired: true, crawlId: crawl.id };
  }

  private nextRun(cron: string, timezone: string): Date | null {
    try {
      return CronExpressionParser.parse(cron, { tz: timezone }).next().toDate();
    } catch {
      return null;
    }
  }
}
