import type { Queue } from 'bullmq';
/**
 * Facade for everything the API enqueues. Queue unavailability is logged and
 * swallowed for advisory jobs (the worker reconciles on its own timer), so a
 * Redis blip never fails a user mutation.
 */
export declare class JobsService {
    private readonly maintenance;
    private readonly logger;
    constructor(maintenance: Queue);
    /** Ask the worker to re-sync BullMQ job schedulers with the schedules table now. */
    requestScheduleReconcile(): Promise<void>;
    /**
     * Readiness probe support. `queue.client` resolves only once the connection
     * is READY, so it must be raced against a timeout — a probe may never hang.
     */
    pingQueues(timeoutMs?: number): Promise<boolean>;
}
