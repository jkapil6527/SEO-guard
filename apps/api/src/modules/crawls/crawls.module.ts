import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@seo-guardian/shared';
import { CrawlProgressService } from './crawl-progress.service';
import { CrawlReadsController } from './crawl-reads.controller';
import { CrawlsController } from './crawls.controller';
import { CrawlsService } from './crawls.service';
import { crawlRedisProvider, crawlRedisSubProvider } from './redis.provider';

@Module({
  imports: [
    // Producers for the crawl queues (root BullMQ connection configured in JobsModule).
    BullModule.registerQueue({ name: QUEUES.CRAWL_ORCHESTRATE }, { name: QUEUES.PAGE_FETCH }),
  ],
  controllers: [CrawlsController, CrawlReadsController],
  providers: [CrawlsService, CrawlProgressService, crawlRedisProvider, crawlRedisSubProvider],
  exports: [CrawlsService],
})
export class CrawlsModule {}
