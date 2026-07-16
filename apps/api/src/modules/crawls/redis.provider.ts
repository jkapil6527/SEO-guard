import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../../config/env';

export const CRAWL_REDIS = Symbol('CRAWL_REDIS');
export const CRAWL_REDIS_SUB = Symbol('CRAWL_REDIS_SUB');

function connect(config: ConfigService<Env, true>): Redis {
  return new Redis(config.get('REDIS_URL', { infer: true }), { maxRetriesPerRequest: 3 });
}

export const crawlRedisProvider = {
  provide: CRAWL_REDIS,
  useFactory: connect,
  inject: [ConfigService],
};

/** Dedicated connection for SSE pub/sub subscription. */
export const crawlRedisSubProvider = {
  provide: CRAWL_REDIS_SUB,
  useFactory: connect,
  inject: [ConfigService],
};
