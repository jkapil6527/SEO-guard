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
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, RequireProjectRole, SuperAdminOnly } from '../../common/decorators';
import { CreateProjectDto, UpdateProjectDto, UpsertMemberDto } from './projects.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Projects visible to the current user' })
  async list(@CurrentUser() user: AuthUser) {
    const data = await this.projectsService.listForUser(user);
    return { data, meta: { nextCursor: null } };
  }

  @Post()
  @SuperAdminOnly()
  @ApiOperation({ summary: 'Create a project (super admin); creator becomes project admin' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: AuthUser, @Ip() ip: string) {
    return this.projectsService.create(dto, { actor, ip });
  }

  @Get(':projectId')
  @RequireProjectRole(ProjectRole.Viewer, 'project', 'projectId')
  @ApiOperation({ summary: 'Project detail' })
  get(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectsService.getById(projectId);
  }

  @Patch(':projectId')
  @RequireProjectRole(ProjectRole.Admin, 'project', 'projectId')
  @ApiOperation({ summary: 'Update project name/settings (admin)' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.projectsService.update(projectId, dto, { actor, ip });
  }

  @Delete(':projectId')
  @RequireProjectRole(ProjectRole.Admin, 'project', 'projectId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a project (admin)' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    await this.projectsService.softDelete(projectId, { actor, ip });
  }

  @Get(':projectId/members')
  @RequireProjectRole(ProjectRole.Viewer, 'project', 'projectId')
  @ApiOperation({ summary: 'List project members' })
  async members(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const data = await this.projectsService.listMembers(projectId);
    return { data, meta: { nextCursor: null } };
  }

  @Put(':projectId/members/:userId')
  @RequireProjectRole(ProjectRole.Admin, 'project', 'projectId')
  @ApiOperation({ summary: 'Add a member or change their role (admin)' })
  upsertMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpsertMemberDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.projectsService.upsertMember(projectId, userId, dto.role, { actor, ip });
  }

  @Delete(':projectId/members/:userId')
  @RequireProjectRole(ProjectRole.Admin, 'project', 'projectId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a member (admin)' })
  async removeMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    await this.projectsService.removeMember(projectId, userId, { actor, ip });
  }
}
