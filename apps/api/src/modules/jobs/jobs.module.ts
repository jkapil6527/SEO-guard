import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@seo-guardian/shared';
import { JobsService } from './jobs.service';

/**
 * Producer side of the queue architecture. The shared connection is configured
 * globally by QueueRootModule; the API only enqueues and reads.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.MAINTENANCE })],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
