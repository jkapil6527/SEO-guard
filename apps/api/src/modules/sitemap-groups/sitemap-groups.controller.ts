import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrawlMode } from '@seo-guardian/shared';
import type { SitemapGroupRow, SitemapGroupSummaryRow } from '@seo-guardian/db';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators';
import {
  CreateSitemapGroupDto,
  PreviewSitemapDto,
  StartGroupCrawlDto,
  UpdateSitemapGroupDto,
} from './sitemap-groups.dto';
import { SitemapGroupsService } from './sitemap-groups.service';

@ApiTags('sitemap-groups')
@Controller()
export class SitemapGroupsController {
  constructor(private readonly service: SitemapGroupsService) {}

  @Get('projects/:projectId/sitemap-groups')
  @ApiOperation({ summary: 'Categories of a project, with dashboard-card rollups' })
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<{ data: SitemapGroupSummaryRow[] }> {
    return this.service.listByProject(projectId).then((data) => ({ data }));
  }

  @Post('projects/:projectId/sitemap-groups')
  @ApiOperation({ summary: 'Create a category' })
  create(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Body() dto: CreateSitemapGroupDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<SitemapGroupRow> {
    return this.service.create({
      websiteId: dto.websiteId,
      name: dto.name,
      sitemapUrl: dto.sitemapUrl,
      actor,
    });
  }

  @Get('sitemap-groups/:groupId')
  @ApiOperation({ summary: 'Category detail' })
  get(@Param('groupId', ParseUUIDPipe) groupId: string): Promise<SitemapGroupRow> {
    return this.service.get(groupId);
  }

  @Get('sitemap-groups/:groupId/trend')
  @ApiOperation({ summary: '30-day score history for this category' })
  trend(
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<{ data: Array<{ day: Date; seoScore: string }> }> {
    return this.service.trend(groupId).then((data) => ({ data }));
  }

  @Patch('sitemap-groups/:groupId')
  @ApiOperation({ summary: 'Rename a category or change its sitemap' })
  update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateSitemapGroupDto,
  ): Promise<SitemapGroupRow> {
    return this.service.update(groupId, dto);
  }

  @Delete('sitemap-groups/:groupId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a category' })
  async remove(@Param('groupId', ParseUUIDPipe) groupId: string): Promise<void> {
    await this.service.remove(groupId);
  }

  @Post('sitemap-groups/:groupId/preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Parse the sitemap and report its contents — does not crawl' })
  preview(@Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: PreviewSitemapDto) {
    return this.service.preview(groupId, dto.sitemapUrl);
  }

  @Post('sitemap-groups/:groupId/crawls')
  @HttpCode(202)
  @ApiOperation({ summary: 'Crawl exactly this category' })
  startCrawl(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: StartGroupCrawlDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.service.startCrawl(groupId, dto.mode ?? CrawlMode.Incremental, { actor, ip });
  }
}
