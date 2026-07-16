import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLogsRepository } from '@seo-guardian/db';
import type { AuditLogRow } from '@seo-guardian/db';
import { ProjectRole } from '@seo-guardian/shared';
import type { Paginated } from '@seo-guardian/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { RequireProjectRole } from '../../common/decorators';

class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeId?: number;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('projects/:projectId/audit-logs')
export class AuditController {
  constructor(private readonly auditLogs: AuditLogsRepository) {}

  @Get()
  @RequireProjectRole(ProjectRole.Admin, 'project', 'projectId')
  @ApiOperation({ summary: 'Project audit trail (admin)' })
  async list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: AuditQueryDto,
  ): Promise<Paginated<AuditLogRow>> {
    const limit = query.limit ?? 50;
    const rows = await this.auditLogs.listByProject(projectId, limit + 1, query.beforeId);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      data: page,
      meta: { nextCursor: rows.length > limit && last ? String(last.id) : null },
    };
  }
}
