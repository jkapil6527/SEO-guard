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
var JobsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
/**
 * Facade for everything the API enqueues. Queue unavailability is logged and
 * swallowed for advisory jobs (the worker reconciles on its own timer), so a
 * Redis blip never fails a user mutation.
 */
let JobsService = JobsService_1 = class JobsService {
    maintenance;
    logger = new common_1.Logger(JobsService_1.name);
    constructor(maintenance) {
        this.maintenance = maintenance;
    }
    /** Ask the worker to re-sync BullMQ job schedulers with the schedules table now. */
    async requestScheduleReconcile() {
        try {
            await this.maintenance.add(shared_1.MAINTENANCE_JOBS.RECONCILE_SCHEDULES, {}, {
                ...shared_1.DEFAULT_JOB_OPTIONS,
                // Collapse bursts of schedule edits into one pending reconcile.
                deduplication: { id: shared_1.MAINTENANCE_JOBS.RECONCILE_SCHEDULES },
                removeOnComplete: true,
                removeOnFail: 100,
            });
        }
        catch (err) {
            this.logger.warn({ err }, 'could not enqueue schedule reconcile; worker will reconcile on its hourly timer');
        }
    }
    /**
     * Readiness probe support. `queue.client` resolves only once the connection
     * is READY, so it must be raced against a timeout — a probe may never hang.
     */
    async pingQueues(timeoutMs = 2_000) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('redis ping timeout')), timeoutMs);
        });
        try {
            const client = (await Promise.race([this.maintenance.client, timeout]));
            await Promise.race([client.ping(), timeout]);
            return true;
        }
        catch {
            return false;
        }
        finally {
            clearTimeout(timer);
        }
    }
};
exports.JobsService = JobsService;
exports.JobsService = JobsService = JobsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.MAINTENANCE)),
    __metadata("design:paramtypes", [Function])
], JobsService);
//# sourceMappingURL=jobs.service.js.map