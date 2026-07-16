import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../../config/env';
export declare const CRAWL_REDIS: unique symbol;
export declare const CRAWL_REDIS_SUB: unique symbol;
declare function connect(config: ConfigService<Env, true>): Redis;
export declare const crawlRedisProvider: {
    provide: symbol;
    useFactory: typeof connect;
    inject: (typeof ConfigService)[];
};
/** Dedicated connection for SSE pub/sub subscription. */
export declare const crawlRedisSubProvider: {
    provide: symbol;
    useFactory: typeof connect;
    inject: (typeof ConfigService)[];
};
export {};
