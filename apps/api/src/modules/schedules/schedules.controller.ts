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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, RequireProjectRole } from '../../common/decorators';
import { CreateScheduleDto, ScheduleResponseDto, UpdateScheduleDto } from './schedules.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('schedules')
@ApiBearerAuth()
@Controller()
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('websites/:websiteId/schedules')
  @RequireProjectRole(ProjectRole.Viewer, 'website', 'websiteId')
  @ApiOperation({ summary: 'List crawl schedules of a website' })
  @ApiOkResponse({ type: [ScheduleResponseDto] })
  async list(@Param('websiteId', ParseUUIDPipe) websiteId: string) {
    const data = await this.schedulesService.list(websiteId);
    return { data, meta: { nextCursor: null } };
  }

  @Post('websites/:websiteId/schedules')
  @RequireProjectRole(ProjectRole.SeoManager, 'website', 'websiteId')
  @ApiOperation({ summary: 'Create a crawl schedule from a preset or cron (seo manager)' })
  @ApiOkResponse({ type: ScheduleResponseDto })
  create(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body() dto: CreateScheduleDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.schedulesService.create(websiteId, dto, { actor, ip });
  }

  @Patch('schedules/:scheduleId')
  @RequireProjectRole(ProjectRole.SeoManager, 'schedule', 'scheduleId')
  @ApiOperation({ summary: 'Update or pause a schedule (seo manager)' })
  @ApiOkResponse({ type: ScheduleResponseDto })
  update(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.schedulesService.update(scheduleId, dto, { actor, ip });
  }

  @Delete('schedules/:scheduleId')
  @RequireProjectRole(ProjectRole.SeoManager, 'schedule', 'scheduleId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a schedule (seo manager)' })
  async remove(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    await this.schedulesService.delete(scheduleId, { actor, ip });
  }
}
