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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, RequireProjectRole } from '../../common/decorators';
import { CreateWebsiteDto, UpdateWebsiteDto } from './websites.dto';
import { WebsitesService } from './websites.service';

@ApiTags('websites')
@ApiBearerAuth()
@Controller()
export class WebsitesController {
  constructor(private readonly websitesService: WebsitesService) {}

  @Get('projects/:projectId/websites')
  @RequireProjectRole(ProjectRole.Viewer, 'project', 'projectId')
  @ApiOperation({ summary: 'List websites in a project' })
  async list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const data = await this.websitesService.list(projectId);
    return { data, meta: { nextCursor: null } };
  }

  @Post('projects/:projectId/websites')
  @RequireProjectRole(ProjectRole.SeoManager, 'project', 'projectId')
  @ApiOperation({ summary: 'Add a website to a project (seo manager)' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateWebsiteDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.websitesService.create(projectId, dto, { actor, ip });
  }

  @Get('websites/:websiteId')
  @RequireProjectRole(ProjectRole.Viewer, 'website', 'websiteId')
  @ApiOperation({ summary: 'Website detail' })
  get(@Param('websiteId', ParseUUIDPipe) websiteId: string) {
    return this.websitesService.getById(websiteId);
  }

  @Patch('websites/:websiteId')
  @RequireProjectRole(ProjectRole.SeoManager, 'website', 'websiteId')
  @ApiOperation({ summary: 'Update a website (seo manager)' })
  update(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body() dto: UpdateWebsiteDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.websitesService.update(websiteId, dto, { actor, ip });
  }

  @Delete('websites/:websiteId')
  @RequireProjectRole(ProjectRole.Admin, 'website', 'websiteId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a website and all its data (admin)' })
  async remove(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    await this.websitesService.delete(websiteId, { actor, ip });
  }
}
