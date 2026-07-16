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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
const db_1 = require("@seo-guardian/db");
const shared_1 = require("@seo-guardian/shared");
const env_1 = require("./config/env");
const env_files_1 = require("./config/env-files");
const browser_pool_service_1 = require("./crawl/browser-pool.service");
const check_catalog_service_1 = require("./crawl/check-catalog.service");
const crawl_producer_service_1 = require("./crawl/crawl-producer.service");
const fetcher_factory_1 = require("./crawl/fetcher.factory");
const page_processor_service_1 = require("./crawl/page-processor.service");
const url_resolver_service_1 = require("./crawl/url-resolver.service");
const crawl_state_service_1 = require("./infra/crawl-state.service");
const html_storage_service_1 = require("./infra/html-storage.service");
const politeness_service_1 = require("./infra/politeness.service");
const redis_provider_1 = require("./infra/redis.provider");
const finalize_processor_1 = require("./processors/finalize.processor");
const link_check_processor_1 = require("./processors/link-check.processor");
const maintenance_processor_1 = require("./processors/maintenance.processor");
const orchestrate_processor_1 = require("./processors/orchestrate.processor");
const page_fetch_processor_1 = require("./processors/page-fetch.processor");
const page_render_processor_1 = require("./processors/page-render.processor");
const schedule_fire_processor_1 = require("./processors/schedule-fire.processor");
const partition_service_1 = require("./services/partition.service");
const scheduler_sync_service_1 = require("./services/scheduler-sync.service");
const ALL_QUEUES = Object.values(shared_1.QUEUES).map((name) => ({ name }));
/** Processor classes gated by the queue they consume (WORKER_QUEUES split). */
const PROCESSOR_BY_QUEUE = {
    [shared_1.QUEUES.MAINTENANCE]: maintenance_processor_1.MaintenanceProcessor,
    [shared_1.QUEUES.SCHEDULE_FIRE]: schedule_fire_processor_1.ScheduleFireProcessor,
    [shared_1.QUEUES.CRAWL_ORCHESTRATE]: orchestrate_processor_1.OrchestrateProcessor,
    [shared_1.QUEUES.PAGE_FETCH]: page_fetch_processor_1.PageFetchProcessor,
    [shared_1.QUEUES.PAGE_RENDER]: page_render_processor_1.PageRenderProcessor,
    [shared_1.QUEUES.LINK_CHECK]: link_check_processor_1.LinkCheckProcessor,
    [shared_1.QUEUES.CRAWL_FINALIZE]: finalize_processor_1.FinalizeProcessor,
};
function selectedProcessors() {
    const enabled = (0, env_1.enabledQueues)((0, env_1.validateEnv)(process.env));
    return Object.entries(PROCESSOR_BY_QUEUE)
        .filter(([queue]) => enabled === 'all' || enabled.has(queue))
        .map(([, processor]) => processor);
}
const repository = (token) => ({
    provide: token,
    useFactory: (db) => new token(db),
    inject: [db_1.Database],
});
let WorkerModule = class WorkerModule {
    maintenance;
    redis;
    schedulerSync;
    partitions;
    catalog;
    db;
    constructor(maintenance, redis, schedulerSync, partitions, catalog, db) {
        this.maintenance = maintenance;
        this.redis = redis;
        this.schedulerSync = schedulerSync;
        this.partitions = partitions;
        this.catalog = catalog;
        this.db = db;
    }
    async onApplicationBootstrap() {
        await this.catalog.seed();
        await this.maintenance.upsertJobScheduler('ensure-partitions-daily', { pattern: '0 1 * * *' }, { name: shared_1.MAINTENANCE_JOBS.ENSURE_PARTITIONS, opts: shared_1.DEFAULT_JOB_OPTIONS });
        await this.maintenance.upsertJobScheduler('reconcile-schedules-hourly', { pattern: '15 * * * *' }, { name: shared_1.MAINTENANCE_JOBS.RECONCILE_SCHEDULES, opts: shared_1.DEFAULT_JOB_OPTIONS });
        // Every 5 min, recover crawls whose finalize died and left them stuck.
        await this.maintenance.upsertJobScheduler('reap-stuck-crawls', { every: 5 * 60 * 1000 }, { name: shared_1.MAINTENANCE_JOBS.REAP_STUCK_CRAWLS, opts: shared_1.DEFAULT_JOB_OPTIONS });
        await this.partitions.ensurePartitions();
        await this.schedulerSync.reconcile();
        // Immediately on startup, sweep up anything a previous interrupted run left
        // stuck — this is exactly when a finalize is most likely to have been killed.
        await this.maintenance.add(shared_1.MAINTENANCE_JOBS.REAP_STUCK_CRAWLS, {}, shared_1.DEFAULT_JOB_OPTIONS);
    }
    async onApplicationShutdown() {
        // BullMQ workers/queues are closed by @nestjs/bullmq on shutdown; close the
        // shared Redis command connection and the DB pool so no handles linger.
        this.redis.disconnect();
        await this.db.close();
    }
};
exports.WorkerModule = WorkerModule;
exports.WorkerModule = WorkerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, validate: env_1.validateEnv, envFilePath: (0, env_files_1.envFilePaths)() }),
            bullmq_1.BullModule.forRootAsync({
                useFactory: (config) => {
                    const url = new URL(config.get('REDIS_URL', { infer: true }));
                    return {
                        connection: {
                            host: url.hostname,
                            port: Number(url.port || 6379),
                            ...(url.username ? { username: url.username } : {}),
                            ...(url.password ? { password: url.password } : {}),
                            db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
                            maxRetriesPerRequest: null,
                        },
                    };
                },
                inject: [config_1.ConfigService],
            }),
            // Every queue registered so producers can enqueue regardless of which
            // processors this instance runs.
            bullmq_1.BullModule.registerQueue(...ALL_QUEUES),
        ],
        providers: [
            {
                provide: db_1.Database,
                useFactory: (config) => new db_1.Database({
                    connectionString: config.get('DATABASE_URL', { infer: true }),
                    applicationName: 'seo-guardian-worker',
                }),
                inject: [config_1.ConfigService],
            },
            repository(db_1.SchedulesRepository),
            repository(db_1.AuditLogsRepository),
            repository(db_1.CrawlsRepository),
            repository(db_1.PagesRepository),
            repository(db_1.PageSnapshotsRepository),
            repository(db_1.PageIssuesRepository),
            repository(db_1.LinkChecksRepository),
            repository(db_1.CrawlAggregatesRepository),
            repository(db_1.SchemaEntitiesRepository),
            repository(db_1.CrawlChangesRepository),
            repository(db_1.UrlSourcesRepository),
            repository(db_1.SitemapGroupsRepository),
            repository(db_1.WebsitesRepository),
            redis_provider_1.redisProvider,
            crawl_state_service_1.CrawlStateService,
            politeness_service_1.PolitenessService,
            html_storage_service_1.HtmlStorageService,
            fetcher_factory_1.FetcherFactory,
            crawl_producer_service_1.CrawlProducerService,
            url_resolver_service_1.UrlResolverService,
            page_processor_service_1.PageProcessorService,
            browser_pool_service_1.BrowserPoolService,
            check_catalog_service_1.CheckCatalogService,
            partition_service_1.PartitionService,
            scheduler_sync_service_1.SchedulerSyncService,
            ...selectedProcessors(),
        ],
    }),
    __param(0, (0, bullmq_1.InjectQueue)(shared_1.QUEUES.MAINTENANCE)),
    __param(1, (0, common_1.Inject)(redis_provider_1.REDIS)),
    __metadata("design:paramtypes", [Function, ioredis_1.Redis,
        scheduler_sync_service_1.SchedulerSyncService,
        partition_service_1.PartitionService,
        check_catalog_service_1.CheckCatalogService,
        db_1.Database])
], WorkerModule);
//# sourceMappingURL=worker.module.js.map