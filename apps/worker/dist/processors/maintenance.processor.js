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
var MaintenanceProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaintenanceProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const shared_1 = require("@seo-guardian/shared");
const crawl_producer_service_1 = require("../crawl/crawl-producer.service");
const partition_service_1 = require("../services/partition.service");
const scheduler_sync_service_1 = require("../services/scheduler-sync.service");
/**
 * A finalize job that started less than this ago might still be legitimately
 * running (heavy cross-page SQL), so the reaper leaves it alone. Older than this
 * and stuck → its finalize died and needs re-driving.
 */
const STUCK_AFTER_MS = 3 * 60 * 1000;
let MaintenanceProcessor = MaintenanceProcessor_1 = class MaintenanceProcessor extends bullmq_1.WorkerHost {
    partitions;
    schedulerSync;
    crawls;
    producer;
    logger = new common_1.Logger(MaintenanceProcessor_1.name);
    constructor(partitions, schedulerSync, crawls, producer) {
        super();
        this.partitions = partitions;
        this.schedulerSync = schedulerSync;
        this.crawls = crawls;
        this.producer = producer;
    }
    async process(job) {
        switch (job.name) {
            case shared_1.MAINTENANCE_JOBS.ENSURE_PARTITIONS:
                return { created: await this.partitions.ensurePartitions() };
            case shared_1.MAINTENANCE_JOBS.RECONCILE_SCHEDULES:
                return this.schedulerSync.reconcile();
            case shared_1.MAINTENANCE_JOBS.REAP_STUCK_CRAWLS:
                return this.reapStuckCrawls();
            default:
                this.logger.warn(`unknown maintenance job '${job.name}' — dropping`);
                return null;
        }
    }
    /**
     * Recover crawls whose finalize died and left them frozen in 'finalizing'
     * (or 'running' at 100%). BullMQ marks a finalize job "stalled" when the
     * worker can't renew its lock — most often because it was interrupted
     * mid-run — and once the stall retries are exhausted the job fails with no
     * one to re-drive it. This sweep re-enqueues finalize (which is idempotent)
     * for each such crawl.
     */
    async reapStuckCrawls() {
        const stuck = await this.crawls.findStuckFinalizing(new Date(Date.now() - STUCK_AFTER_MS));
        let reaped = 0;
        for (const crawl of stuck) {
            const enqueued = await this.producer.redriveFinalize(crawl.id);
            if (enqueued) {
                reaped += 1;
                this.logger.warn(`re-driving stuck finalize for crawl ${crawl.id} (was ${crawl.status})`);
            }
        }
        if (reaped > 0)
            this.logger.log(`reaped ${reaped} stuck crawl(s)`);
        return { reaped };
    }
};
exports.MaintenanceProcessor = MaintenanceProcessor;
exports.MaintenanceProcessor = MaintenanceProcessor = MaintenanceProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(shared_1.QUEUES.MAINTENANCE),
    __metadata("design:paramtypes", [partition_service_1.PartitionService,
        scheduler_sync_service_1.SchedulerSyncService,
        db_1.CrawlsRepository,
        crawl_producer_service_1.CrawlProducerService])
], MaintenanceProcessor);
//# sourceMappingURL=maintenance.processor.js.map