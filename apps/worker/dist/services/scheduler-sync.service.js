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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SchedulerSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerSyncService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const shared_1 = require("@seo-guardian/shared");
/**
 * The schedules table is the source of truth; BullMQ job schedulers are a
 * projection of it. This service converges the projection: one scheduler per
 * active schedule row (id = schedule id), stale schedulers removed. Runs on
 * boot, hourly, and on demand when the API mutates schedules.
 */
let SchedulerSyncService = SchedulerSyncService_1 = class SchedulerSyncService {
    scheduleQueue;
    schedules;
    logger = new common_1.Logger(SchedulerSyncService_1.name);
    constructor(scheduleQueue, schedules) {
        this.scheduleQueue = scheduleQueue;
        this.schedules = schedules;
    }
    async reconcile() {
        const active = await this.schedules.listAllActive();
        const activeIds = new Set(active.map((s) => s.id));
        let upserted = 0;
        for (const schedule of active) {
            const data = {
                scheduleId: schedule.id,
                websiteId: schedule.websiteId,
            };
            await this.scheduleQueue.upsertJobScheduler(schedule.id, { pattern: schedule.cron, tz: schedule.timezone }, {
                name: 'fire',
                data,
                opts: { removeOnComplete: { age: 24 * 3600 }, removeOnFail: { age: 7 * 24 * 3600 } },
            });
            upserted += 1;
        }
        let removed = 0;
        const existing = await this.scheduleQueue.getJobSchedulers(0, -1);
        for (const scheduler of existing) {
            if (scheduler.key && !activeIds.has(scheduler.key)) {
                await this.scheduleQueue.removeJobScheduler(scheduler.key);
                removed += 1;
            }
        }
        this.logger.log(`schedule reconcile: ${upserted} upserted, ${removed} removed`);
        return { upserted, removed };
    }
};
exports.SchedulerSyncService = SchedulerSyncService;
exports.SchedulerSyncService = SchedulerSyncService = SchedulerSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.SCHEDULE_FIRE)),
    __metadata("design:paramtypes", [Function, db_1.SchedulesRepository])
], SchedulerSyncService);
//# sourceMappingURL=scheduler-sync.service.js.map