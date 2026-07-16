import { Injectable, NotFoundException } from '@nestjs/common';
import { SchedulesRepository, WebsitesRepository } from '@seo-guardian/db';
import type { ScheduleRow } from '@seo-guardian/db';
import { AuditAction, CrawlMode, ERROR_CODES } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { assertValidTimezone, resolveCron } from './cron.util';
import type { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto';

interface ActorContext {
  actor: AuthUser;
  ip: string | null;
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly schedules: SchedulesRepository,
    private readonly websites: WebsitesRepository,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  list(websiteId: string): Promise<ScheduleRow[]> {
    return this.schedules.listByWebsite(websiteId);
  }

  async create(websiteId: string, dto: CreateScheduleDto, ctx: ActorContext): Promise<ScheduleRow> {
    const timezone = dto.timezone ?? 'Asia/Kolkata';
    assertValidTimezone(timezone);
    const { cron, nextRunAt } = resolveCron({ preset: dto.preset, cron: dto.cron, timezone });

    const schedule = await this.schedules.create({
      websiteId,
      cron,
      timezone,
      mode: dto.mode ?? CrawlMode.Incremental,
      nextRunAt,
      createdBy: ctx.actor.id,
    });
    await this.recordAudit(websiteId, AuditAction.Create, schedule.id, ctx, {
      after: { cron, timezone, mode: schedule.mode },
    });
    await this.jobs.requestScheduleReconcile();
    return schedule;
  }

  async update(
    scheduleId: string,
    dto: UpdateScheduleDto,
    ctx: ActorContext,
  ): Promise<ScheduleRow> {
    const before = await this.getById(scheduleId);
    const timezone = dto.timezone ?? before.timezone;
    assertValidTimezone(timezone);

    let cron: string | undefined;
    let nextRunAt: Date | undefined;
    if (dto.preset || dto.cron) {
      const resolved = resolveCron({ preset: dto.preset, cron: dto.cron, timezone });
      cron = resolved.cron;
      nextRunAt = resolved.nextRunAt;
    } else if (dto.timezone && dto.timezone !== before.timezone) {
      const resolved = resolveCron({ cron: before.cron, timezone });
      nextRunAt = resolved.nextRunAt;
    }

    const updated = await this.schedules.update(scheduleId, {
      cron,
      timezone: dto.timezone,
      mode: dto.mode,
      isActive: dto.isActive,
      nextRunAt: dto.isActive === false ? null : nextRunAt,
    });
    if (!updated) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'schedule not found' });
    }
    await this.recordAudit(before.websiteId, AuditAction.Update, scheduleId, ctx, {
      before: {
        cron: before.cron,
        timezone: before.timezone,
        mode: before.mode,
        isActive: before.isActive,
      },
      after: {
        cron: updated.cron,
        timezone: updated.timezone,
        mode: updated.mode,
        isActive: updated.isActive,
      },
    });
    await this.jobs.requestScheduleReconcile();
    return updated;
  }

  async delete(scheduleId: string, ctx: ActorContext): Promise<void> {
    const schedule = await this.getById(scheduleId);
    await this.schedules.delete(scheduleId);
    await this.recordAudit(schedule.websiteId, AuditAction.Delete, scheduleId, ctx, {
      before: { cron: schedule.cron, timezone: schedule.timezone },
    });
    await this.jobs.requestScheduleReconcile();
  }

  private async getById(scheduleId: string): Promise<ScheduleRow> {
    const schedule = await this.schedules.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'schedule not found' });
    }
    return schedule;
  }

  private async recordAudit(
    websiteId: string,
    action: AuditAction,
    entityId: string,
    ctx: ActorContext,
    diff: { before?: Record<string, unknown>; after?: Record<string, unknown> },
  ): Promise<void> {
    const projectId = await this.websites.projectIdOf(websiteId);
    await this.audit.record({
      ...ctx,
      projectId,
      action,
      entity: 'schedule',
      entityId,
      before: diff.before ?? null,
      after: diff.after ?? null,
    });
  }
}
