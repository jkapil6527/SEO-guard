import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env';
export declare const REDIS: unique symbol;
/**
 * Shared command connection for counters, flags, dedupe sets and progress
 * publication. Closed on application shutdown by WorkerModule so the process
 * exits cleanly (no lingering handles → no --forceExit in tests).
 */
export declare const redisProvider: {
    provide: symbol;
    useFactory: (config: ConfigService<Env, true>) => Redis;
    inject: (typeof ConfigService)[];
};
