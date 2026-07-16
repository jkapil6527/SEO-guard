import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrawlMode, CrawlScope, ProjectRole } from '@seo-guardian/shared';
import type { CrawlProgressEvent, Paginated } from '@seo-guardian/shared';
import type { CrawlReportRow, CrawlRow } from '@seo-guardian/db';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, RequireProjectRole } from '../../common/decorators';
import { decodeTimeCursor, encodeTimeCursor } from '../../common/pagination';
import { CursorQueryDto } from '../../common/pagination';
import { CrawlProgressService } from './crawl-progress.service';
import { CrawlReportQueryDto, StartCrawlDto } from './crawls.dto';
import { CrawlsService } from './crawls.service';

@ApiTags('crawls')
@ApiBearerAuth()
@Controller()
export class CrawlsController {
  constructor(
    private readonly crawlsService: CrawlsService,
    private readonly progress: CrawlProgressService,
  ) {}

  @Post('websites/:websiteId/crawls')
  @RequireProjectRole(ProjectRole.SeoManager, 'website', 'websiteId')
  @HttpCode(202)
  @ApiOperation({ summary: 'Start a crawl (seo manager)' })
  async start(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body() dto: StartCrawlDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    const crawl = await this.crawlsService.start(
      websiteId,
      dto.mode ?? CrawlMode.Incremental,
      dto.scope ?? CrawlScope.Site,
      dto.url,
      { actor, ip },
      dto.sitemapGroupId,
    );
    return { crawlId: crawl.id, status: crawl.status };
  }

  @Get('crawls')
  @ApiOperation({ summary: 'Crawl reports across every website' })
  async reports(@Query() query: CrawlReportQueryDto): Promise<Paginated<CrawlReportRow>> {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? decodeTimeCursor(query.cursor) : undefined;
    const rows = await this.crawlsService.listAll(limit + 1, cursor?.createdAt, query.projectId);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      data: page,
      meta: {
        nextCursor:
          rows.length > limit && last
            ? encodeTimeCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }

  @Get('websites/:websiteId/crawls')
  @RequireProjectRole(ProjectRole.Viewer, 'website', 'websiteId')
  @ApiOperation({ summary: 'Crawl history for a website' })
  async history(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Query() query: CursorQueryDto,
  ): Promise<Paginated<CrawlRow>> {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? decodeTimeCursor(query.cursor) : undefined;
    const rows = await this.crawlsService.history(websiteId, limit + 1, cursor?.createdAt);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      data: page,
      meta: {
        nextCursor:
          rows.length > limit && last
            ? encodeTimeCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }

  @Get('crawls/:crawlId')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Crawl status with live counters' })
  status(@Param('crawlId', ParseUUIDPipe) crawlId: string) {
    return this.crawlsService.getStatus(crawlId);
  }

  @Sse('crawls/:crawlId/progress')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Live crawl progress (SSE stream)' })
  progressStream(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
  ): Observable<{ data: CrawlProgressEvent }> {
    return this.progress.stream(crawlId).pipe(map((event) => ({ data: event })));
  }

  @Post('crawls/:crawlId/pause')
  @RequireProjectRole(ProjectRole.SeoManager, 'crawl', 'crawlId')
  @HttpCode(202)
  @ApiOperation({ summary: 'Pause a running crawl (seo manager)' })
  async pause(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    await this.crawlsService.pause(crawlId, { actor, ip });
    return { status: 'paused' };
  }

  @Post('crawls/:crawlId/resume')
  @RequireProjectRole(ProjectRole.SeoManager, 'crawl', 'crawlId')
  @HttpCode(202)
  @ApiOperation({ summary: 'Resume a paused crawl (seo manager)' })
  async resume(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    await this.crawlsService.resume(crawlId, { actor, ip });
    return { status: 'running' };
  }

  @Post('crawls/:crawlId/cancel')
  @RequireProjectRole(ProjectRole.SeoManager, 'crawl', 'crawlId')
  @HttpCode(202)
  @ApiOperation({ summary: 'Cancel a crawl (seo manager)' })
  async cancel(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    await this.crawlsService.cancel(crawlId, { actor, ip });
    return { status: 'cancelling' };
  }

  @Post('crawls/:crawlId/retry-failed')
  @RequireProjectRole(ProjectRole.SeoManager, 'crawl', 'crawlId')
  @HttpCode(202)
  @ApiOperation({ summary: 'Re-enqueue failed pages of a crawl (seo manager)' })
  retryFailed(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.crawlsService.retryFailed(crawlId, { actor, ip });
  }
}
