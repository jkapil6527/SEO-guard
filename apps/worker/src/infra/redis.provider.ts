import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env';

export const REDIS = Symbol('REDIS');

/**
 * Shared command connection for counters, flags, dedupe sets and progress
 * publication. Closed on application shutdown by WorkerModule so the process
 * exits cleanly (no lingering handles → no --forceExit in tests).
 */
export const redisProvider = {
  provide: REDIS,
  useFactory: (config: ConfigService<Env, true>): Redis =>
    new Redis(config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    }),
  inject: [ConfigService],
};
