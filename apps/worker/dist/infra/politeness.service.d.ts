import { Redis } from 'ioredis';
/**
 * Per-domain request-rate limiter shared across all fetch workers. A fixed
 * one-second window counter in Redis bounds requests/sec/domain regardless of
 * how many workers scale up (docs/05 §1 politeness). Returns the milliseconds a
 * caller should wait before retrying when the window is full.
 */
export declare class PolitenessService {
    private readonly redis;
    constructor(redis: Redis);
    /**
     * Atomically reserves a request slot for `domain`. Returns { allowed: true }
     * when under the per-second cap, else the delay in ms until the next window.
     */
    acquire(domain: string, ratePerSec: number): Promise<{
        allowed: boolean;
        retryInMs: number;
    }>;
}
