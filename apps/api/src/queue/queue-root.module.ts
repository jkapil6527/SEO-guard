import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/**
 * Registers the shared BullMQ connection once, app-wide, so any feature module
 * can `BullModule.registerQueue(...)` as a producer. The API only ever produces
 * jobs; consumers live in apps/worker.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService<Env, true>) => {
        const url = new URL(config.get('REDIS_URL', { infer: true }));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            ...(url.username ? { username: url.username } : {}),
            ...(url.password ? { password: url.password } : {}),
            db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
            maxRetriesPerRequest: 3,
            enableOfflineQueue: false,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [BullModule],
})
export class QueueRootModule {}
