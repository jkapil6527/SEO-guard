import { Inject, Injectable } from '@nestjs/common';
import { domainRateKey } from '@seo-guardian/shared';
import { Redis } from 'ioredis';
import { REDIS } from './redis.provider';

/**
 * Per-domain request-rate limiter shared across all fetch workers. A fixed
 * one-second window counter in Redis bounds requests/sec/domain regardless of
 * how many workers scale up (docs/05 §1 politeness). Returns the milliseconds a
 * caller should wait before retrying when the window is full.
 */
@Injectable()
export class PolitenessService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * Atomically reserves a request slot for `domain`. Returns { allowed: true }
   * when under the per-second cap, else the delay in ms until the next window.
   */
  async acquire(
    domain: string,
    ratePerSec: number,
  ): Promise<{ allowed: boolean; retryInMs: number }> {
    const windowMs = 1000;
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const key = `${domainRateKey(domain)}:${bucket}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.pexpire(key, windowMs * 2);
    }
    if (count <= ratePerSec) {
      return { allowed: true, retryInMs: 0 };
    }
    const retryInMs = (bucket + 1) * windowMs - now;
    return { allowed: false, retryInMs: Math.max(1, retryInMs) };
  }
}
