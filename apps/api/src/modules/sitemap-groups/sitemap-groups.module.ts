import { Module } from '@nestjs/common';
import { CrawlsModule } from '../crawls/crawls.module';
import { SitemapGroupsController } from './sitemap-groups.controller';
import { SitemapGroupsService } from './sitemap-groups.service';

@Module({
  imports: [CrawlsModule],
  controllers: [SitemapGroupsController],
  providers: [SitemapGroupsService],
  exports: [SitemapGroupsService],
})
export class SitemapGroupsModule {}
