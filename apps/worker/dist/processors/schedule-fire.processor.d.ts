import { WorkerHost } from '@nestjs/bullmq';
import { CrawlsRepository, SchedulesRepository } from '@seo-guardian/db';
import type { ScheduleFireJobData } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import { CrawlProducerService } from '../crawl/crawl-producer.service';
/**
 * Consumes schedule firings: advances schedule bookkeeping and starts a crawl
 * for the website. Overlap guard skips a firing when a crawl is already active.
 */
export declare class ScheduleFireProcessor extends WorkerHost {
    private readonly schedules;
    private readonly crawls;
    private readonly producer;
    private readonly logger;
    constructor(schedules: SchedulesRepository, crawls: CrawlsRepository, producer: CrawlProducerService);
    process(job: Job<ScheduleFireJobData>): Promise<unknown>;
    private nextRun;
}
