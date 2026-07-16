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
var ScheduleFireProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleFireProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const seo_engine_1 = require("@seo-guardian/seo-engine");
const shared_1 = require("@seo-guardian/shared");
const cron_parser_1 = require("cron-parser");
const crawl_producer_service_1 = require("../crawl/crawl-producer.service");
/**
 * Consumes schedule firings: advances schedule bookkeeping and starts a crawl
 * for the website. Overlap guard skips a firing when a crawl is already active.
 */
let ScheduleFireProcessor = ScheduleFireProcessor_1 = class ScheduleFireProcessor extends bullmq_1.WorkerHost {
    schedules;
    crawls;
    producer;
    logger = new common_1.Logger(ScheduleFireProcessor_1.name);
    constructor(schedules, crawls, producer) {
        super();
        this.schedules = schedules;
        this.crawls = crawls;
        this.producer = producer;
    }
    async process(job) {
        const { scheduleId, websiteId } = job.data;
        const schedule = await this.schedules.findById(scheduleId);
        if (!schedule || !schedule.isActive) {
            this.logger.warn(`schedule ${scheduleId} no longer active; ignoring firing`);
            return { fired: false };
        }
        await this.schedules.markFired(scheduleId, this.nextRun(schedule.cron, schedule.timezone));
        // Overlap guard: don't stack crawls on a website that is still crawling.
        const active = await this.crawls.findActiveForScope(websiteId);
        if (active) {
            this.logger.warn(`website ${websiteId} already crawling (${active.id}); skipping scheduled crawl`);
            return { fired: true, skipped: 'overlap' };
        }
        const crawl = await this.crawls.create({
            websiteId,
            trigger: 'scheduled',
            mode: schedule.mode,
            scope: shared_1.CrawlScope.Site,
            targetUrl: null,
            rulePackVersion: seo_engine_1.ENGINE_VERSION,
            createdBy: null,
        });
        await this.producer.enqueueOrchestrate({ crawlId: crawl.id }, 20);
        this.logger.log(`scheduled crawl ${crawl.id} started for website ${websiteId} (mode=${schedule.mode})`);
        return { fired: true, crawlId: crawl.id };
    }
    nextRun(cron, timezone) {
        try {
            return cron_parser_1.CronExpressionParser.parse(cron, { tz: timezone }).next().toDate();
        }
        catch {
            return null;
        }
    }
};
exports.ScheduleFireProcessor = ScheduleFireProcessor;
exports.ScheduleFireProcessor = ScheduleFireProcessor = ScheduleFireProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(shared_1.QUEUES.SCHEDULE_FIRE),
    __metadata("design:paramtypes", [db_1.SchedulesRepository,
        db_1.CrawlsRepository,
        crawl_producer_service_1.CrawlProducerService])
], ScheduleFireProcessor);
//# sourceMappingURL=schedule-fire.processor.js.map