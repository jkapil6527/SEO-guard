"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulesService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const shared_1 = require("@seo-guardian/shared");
const audit_service_1 = require("../audit/audit.service");
const jobs_service_1 = require("../jobs/jobs.service");
const cron_util_1 = require("./cron.util");
let SchedulesService = class SchedulesService {
    schedules;
    websites;
    jobs;
    audit;
    constructor(schedules, websites, jobs, audit) {
        this.schedules = schedules;
        this.websites = websites;
        this.jobs = jobs;
        this.audit = audit;
    }
    list(websiteId) {
        return this.schedules.listByWebsite(websiteId);
    }
    async create(websiteId, dto, ctx) {
        const timezone = dto.timezone ?? 'Asia/Kolkata';
        (0, cron_util_1.assertValidTimezone)(timezone);
        const { cron, nextRunAt } = (0, cron_util_1.resolveCron)({ preset: dto.preset, cron: dto.cron, timezone });
        const schedule = await this.schedules.create({
            websiteId,
            cron,
            timezone,
            mode: dto.mode ?? shared_1.CrawlMode.Incremental,
            nextRunAt,
            createdBy: ctx.actor.id,
        });
        await this.recordAudit(websiteId, shared_1.AuditAction.Create, schedule.id, ctx, {
            after: { cron, timezone, mode: schedule.mode },
        });
        await this.jobs.requestScheduleReconcile();
        return schedule;
    }
    async update(scheduleId, dto, ctx) {
        const before = await this.getById(scheduleId);
        const timezone = dto.timezone ?? before.timezone;
        (0, cron_util_1.assertValidTimezone)(timezone);
        let cron;
        let nextRunAt;
        if (dto.preset || dto.cron) {
            const resolved = (0, cron_util_1.resolveCron)({ preset: dto.preset, cron: dto.cron, timezone });
            cron = resolved.cron;
            nextRunAt = resolved.nextRunAt;
        }
        else if (dto.timezone && dto.timezone !== before.timezone) {
            const resolved = (0, cron_util_1.resolveCron)({ cron: before.cron, timezone });
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
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'schedule not found' });
        }
        await this.recordAudit(before.websiteId, shared_1.AuditAction.Update, scheduleId, ctx, {
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
    async delete(scheduleId, ctx) {
        const schedule = await this.getById(scheduleId);
        await this.schedules.delete(scheduleId);
        await this.recordAudit(schedule.websiteId, shared_1.AuditAction.Delete, scheduleId, ctx, {
            before: { cron: schedule.cron, timezone: schedule.timezone },
        });
        await this.jobs.requestScheduleReconcile();
    }
    async getById(scheduleId) {
        const schedule = await this.schedules.findById(scheduleId);
        if (!schedule) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'schedule not found' });
        }
        return schedule;
    }
    async recordAudit(websiteId, action, entityId, ctx, diff) {
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
};
exports.SchedulesService = SchedulesService;
exports.SchedulesService = SchedulesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.SchedulesRepository,
        db_1.WebsitesRepository,
        jobs_service_1.JobsService,
        audit_service_1.AuditService])
], SchedulesService);
//# sourceMappingURL=schedules.service.js.map