import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CrawlAggregatesRepository,
  PageIssuesRepository,
  PageSnapshotsRepository,
} from '@seo-guardian/db';
import { getCatalogCheck } from '@seo-guardian/seo-engine';
import { ERROR_CODES, ProjectRole } from '@seo-guardian/shared';
import type { Paginated } from '@seo-guardian/shared';
import { RequireProjectRole } from '../../common/decorators';
import { decodeTimeCursor, encodeTimeCursor } from '../../common/pagination';
import { CrawlIssueQueryDto, CrawlPageQueryDto } from './crawls.dto';

/** Read models over a crawl's snapshots, issues and aggregates. */
@ApiTags('crawls')
@ApiBearerAuth()
@Controller('crawls/:crawlId')
export class CrawlReadsController {
  constructor(
    private readonly snapshots: PageSnapshotsRepository,
    private readonly issues: PageIssuesRepository,
    private readonly aggregates: CrawlAggregatesRepository,
  ) {}

  @Get('pages')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Pages crawled in this crawl (filterable)' })
  async pages(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @Query() query: CrawlPageQueryDto,
  ): Promise<Paginated<unknown>> {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? decodeTimeCursor(query.cursor) : undefined;
    const rows = await this.snapshots.listByCrawl(crawlId, {
      limit: limit + 1,
      cursor,
      fetchStatus: query.fetchStatus,
    });
    return this.paginate(rows, limit);
  }

  @Get('pages/:pageId')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'A single page snapshot with fully-explained issues' })
  async page(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    const snapshot = await this.snapshots.findByCrawlAndPage(crawlId, pageId);
    if (!snapshot) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'page snapshot not found',
      });
    }

    const [rows, duplicates] = await Promise.all([
      this.issues.listByPage(crawlId, pageId),
      this.issues.duplicateSiblings(crawlId, pageId),
    ]);

    // Join each issue to its catalog entry so the report can answer
    // what / where / why / impact / how-to-fix without a second lookup, and
    // attach the colliding URLs to duplicate findings — the "where" of a
    // duplicate is the set of pages it collides with.
    const issues = rows.map((issue) => {
      const meta = getCatalogCheck(issue.checkId);
      const dup = issue.checkId.startsWith('duplicate.')
        ? duplicates.find((d) => d.field === (issue.evidence as { field?: string }).field)
        : undefined;
      return {
        ...issue,
        check: meta
          ? {
              name: meta.name,
              category: meta.category,
              description: meta.description,
              technicalExplanation: meta.technicalExplanation,
              businessImpact: meta.businessImpact,
              suggestedFix: meta.suggestedFix,
              docUrl: meta.docUrl,
              weight: meta.weight,
            }
          : null,
        duplicateOf: dup ? { sample: dup.sample, pageCount: dup.pageCount, urls: dup.urls } : null,
      };
    });

    return { snapshot, issues, duplicates };
  }

  @Get('duplicates')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Duplicate title / description / h1 groups across the crawl' })
  duplicates(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @Query('field') field?: string,
  ): Promise<{ data: Array<{ field: string; sample: string; pageCount: number; urls: string[] }> }> {
    return this.issues.listDuplicateGroups(crawlId, field).then((data) => ({ data }));
  }

  @Get('issues')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Issues in this crawl (filter by severity/checkId)' })
  async issuesList(
    @Param('crawlId', ParseUUIDPipe) crawlId: string,
    @Query() query: CrawlIssueQueryDto,
  ): Promise<Paginated<unknown>> {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? decodeTimeCursor(query.cursor) : undefined;
    const rows = await this.issues.listByCrawl(crawlId, {
      limit: limit + 1,
      cursor,
      severity: query.severity,
      checkId: query.checkId,
    });
    return this.paginate(rows, limit);
  }

  @Get('issues/summary')
  @RequireProjectRole(ProjectRole.Viewer, 'crawl', 'crawlId')
  @ApiOperation({ summary: 'Issue counts by check and severity' })
  async issuesSummary(@Param('crawlId', ParseUUIDPipe) crawlId: string) {
    const [byCheck, bySeverity, aggregate] = await Promise.all([
      this.issues.summaryByCrawl(crawlId),
      this.issues.countsBySeverity(crawlId),
      this.aggregates.findByCrawl(crawlId),
    ]);
    return { byCheck, bySeverity, aggregate };
  }

  private paginate<T extends { createdAt: Date; id: string }>(
    rows: T[],
    limit: number,
  ): Paginated<T> {
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
}
