import { SchedulesRepository } from '@seo-guardian/db';
import type { Queue } from 'bullmq';
/**
 * The schedules table is the source of truth; BullMQ job schedulers are a
 * projection of it. This service converges the projection: one scheduler per
 * active schedule row (id = schedule id), stale schedulers removed. Runs on
 * boot, hourly, and on demand when the API mutates schedules.
 */
export declare class SchedulerSyncService {
    private readonly scheduleQueue;
    private readonly schedules;
    private readonly logger;
    constructor(scheduleQueue: Queue, schedules: SchedulesRepository);
    reconcile(): Promise<{
        upserted: number;
        removed: number;
    }>;
}
