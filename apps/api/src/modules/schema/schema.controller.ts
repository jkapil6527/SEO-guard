import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CrawlAggregatesRepository,
  CrawlChangesRepository,
  CrawlsRepository,
  SchemaEntitiesRepository,
} from '@seo-guardian/db';
import { ProjectRole } from '@seo-guardian/shared';
import type { Paginated } from '@seo-guardian/shared';
import { RequireProjectRole } from '../../common/decorators';
import { decodeTimeCursor, encodeTimeCursor } from '../../common/pagination';
import { SchemaChangeQueryDto, SchemaEntityQueryDto } from './schema.dto';

/** Schema.org read APIs: entities, coverage, rich results, history and changes. */
@ApiTags('schema')
@ApiBearerAuth()
@Controller()
export class SchemaController {
  constructor(
    private readonly schema: SchemaEntitiesRepository,
    private readonly changes: CrawlChangesRepository,
    private readonly aggregates: CrawlAggregatesRepository,
    private readonly crawls: CrawlsRepository,
  ) {}

  @Get('crawls/:crawlId/schema')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Schema entities detected in a crawl (filterable)' })
  async entities(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @Query() query: SchemaEntityQueryDto,
  ): Promise<Paginated<unknown>> {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? decodeTimeCursor(query.cursor) : undefined;
    const rows = await this.schema.listByCrawl(crawlId, {
      limit: limit + 1,
      cursor,
      schemaType: query.schemaType,
      status: query.status,
      format: query.format,
    });
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

  @Get('crawls/:crawlId/schema/coverage')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Schema coverage metrics for a crawl' })
  async coverage(@Param('crawlId', ParseUUIDPipe) crawlId: string) {
    const [coverage, typeFrequency, statusCounts, aggregate] = await Promise.all([
      this.schema.coverage(crawlId),
      this.schema.typeFrequency(crawlId),
      this.schema.statusCounts(crawlId),
      this.aggregates.findByCrawl(crawlId),
    ]);
    const metrics = (aggregate?.metrics ?? {}) as { schema?: unknown };
    return { coverage, typeFrequency, statusCounts, aggregate: metrics.schema ?? null };
  }

  @Get('crawls/:crawlId/schema/rich-results')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Rich-result eligibility rollup by profile' })
  richResults(@Param('crawlId', ParseUUIDPipe) crawlId: string) {
    return this.schema.richResultSummary(crawlId);
  }

  @Get('crawls/:crawlId/pages/:pageId/schema')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Schema entities and validation for one page' })
  async pageSchema(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    const entities = await this.schema.listByPage(crawlId, pageId);
    return { data: entities };
  }

  @Get('crawls/:crawlId/changes')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Changes detected vs the previous crawl (incl. schema)' })
  async changesList(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @Query() query: SchemaChangeQueryDto,
  ): Promise<Paginated<unknown>> {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? decodeTimeCursor(query.cursor) : undefined;
    const rows = await this.changes.listByCrawl(crawlId, {
      limit: limit + 1,
      cursor,
      changeType: query.changeType,
    });
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

  @Get('crawls/:crawlId/changes/summary')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Change counts by type for a crawl' })
  changesSummary(@Param('crawlId', ParseUUIDPipe) crawlId: string) {
    return this.changes.summary(crawlId);
  }

  @Get('websites/:websiteId/schema/history')
  @RequireProjectRole(ProjectRole.Viewer, 'website', 'websiteId')
  @ApiOperation({ summary: 'Schema coverage across recent crawls of a website' })
  async history(@Param('websiteId', ParseUUIDPipe) websiteId: string) {
    const crawls = await this.crawls.listByWebsite(websiteId, 30);
    const completed = crawls.filter((c) => c.status === 'completed');
    const history = await Promise.all(
      completed.map(async (c) => {
        const aggregate = await this.aggregates.findByCrawl(c.id);
        const metrics = (aggregate?.metrics ?? {}) as { schema?: unknown };
        return { crawlId: c.id, date: c.createdAt, schema: metrics.schema ?? null };
      }),
    );
    return { data: history };
  }
}
