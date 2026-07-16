import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Inject, Module } from '@nestjs/common';
import type { OnApplicationBootstrap, OnApplicationShutdown, Provider, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import {
  AuditLogsRepository,
  CrawlAggregatesRepository,
  CrawlsRepository,
  Database,
  CrawlChangesRepository,
  LinkChecksRepository,
  PageIssuesRepository,
  PageSnapshotsRepository,
  PagesRepository,
  SchedulesRepository,
  SchemaEntitiesRepository,
  SitemapGroupsRepository,
  UrlSourcesRepository,
  WebsitesRepository,
} from '@seo-guardian/db';
import { DEFAULT_JOB_OPTIONS, MAINTENANCE_JOBS, QUEUES } from '@seo-guardian/shared';
import type { Queue } from 'bullmq';
import { enabledQueues, validateEnv } from './config/env';
import type { Env } from './config/env';
import { envFilePaths } from './config/env-files';
import { BrowserPoolService } from './crawl/browser-pool.service';
import { CheckCatalogService } from './crawl/check-catalog.service';
import { CrawlProducerService } from './crawl/crawl-producer.service';
import { FetcherFactory } from './crawl/fetcher.factory';
import { PageProcessorService } from './crawl/page-processor.service';
import { UrlResolverService } from './crawl/url-resolver.service';
import { CrawlStateService } from './infra/crawl-state.service';
import { HtmlStorageService } from './infra/html-storage.service';
import { PolitenessService } from './infra/politeness.service';
import { REDIS, redisProvider } from './infra/redis.provider';
import { FinalizeProcessor } from './processors/finalize.processor';
import { LinkCheckProcessor } from './processors/link-check.processor';
import { MaintenanceProcessor } from './processors/maintenance.processor';
import { OrchestrateProcessor } from './processors/orchestrate.processor';
import { PageFetchProcessor } from './processors/page-fetch.processor';
import { PageRenderProcessor } from './processors/page-render.processor';
import { ScheduleFireProcessor } from './processors/schedule-fire.processor';
import { PartitionService } from './services/partition.service';
import { SchedulerSyncService } from './services/scheduler-sync.service';

const ALL_QUEUES = Object.values(QUEUES).map((name) => ({ name }));

/** Processor classes gated by the queue they consume (WORKER_QUEUES split). */
const PROCESSOR_BY_QUEUE: Record<string, Type> = {
  [QUEUES.MAINTENANCE]: MaintenanceProcessor,
  [QUEUES.SCHEDULE_FIRE]: ScheduleFireProcessor,
  [QUEUES.CRAWL_ORCHESTRATE]: OrchestrateProcessor,
  [QUEUES.PAGE_FETCH]: PageFetchProcessor,
  [QUEUES.PAGE_RENDER]: PageRenderProcessor,
  [QUEUES.LINK_CHECK]: LinkCheckProcessor,
  [QUEUES.CRAWL_FINALIZE]: FinalizeProcessor,
};

function selectedProcessors(): Provider[] {
  const enabled = enabledQueues(validateEnv(process.env as Record<string, unknown>));
  return Object.entries(PROCESSOR_BY_QUEUE)
    .filter(([queue]) => enabled === 'all' || enabled.has(queue))
    .map(([, processor]) => processor as Provider);
}

const repository = <T>(token: Type<T>): Provider => ({
  provide: token,
  useFactory: (db: Database) => new (token as new (db: Database) => T)(db),
  inject: [Database],
});

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: envFilePaths() }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService<Env, true>) => {
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
      inject: [ConfigService],
    }),
    // Every queue registered so producers can enqueue regardless of which
    // processors this instance runs.
    BullModule.registerQueue(...ALL_QUEUES),
  ],
  providers: [
    {
      provide: Database,
      useFactory: (config: ConfigService<Env, true>) =>
        new Database({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          applicationName: 'seo-guardian-worker',
        }),
      inject: [ConfigService],
    },
    repository(SchedulesRepository),
    repository(AuditLogsRepository),
    repository(CrawlsRepository),
    repository(PagesRepository),
    repository(PageSnapshotsRepository),
    repository(PageIssuesRepository),
    repository(LinkChecksRepository),
    repository(CrawlAggregatesRepository),
    repository(SchemaEntitiesRepository),
    repository(CrawlChangesRepository),
    repository(UrlSourcesRepository),
    repository(SitemapGroupsRepository),
    repository(WebsitesRepository),
    redisProvider,
    CrawlStateService,
    PolitenessService,
    HtmlStorageService,
    FetcherFactory,
    CrawlProducerService,
    UrlResolverService,
    PageProcessorService,
    BrowserPoolService,
    CheckCatalogService,
    PartitionService,
    SchedulerSyncService,
    ...selectedProcessors(),
  ],
})
export class WorkerModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    @InjectQueue(QUEUES.MAINTENANCE) private readonly maintenance: Queue,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly schedulerSync: SchedulerSyncService,
    private readonly partitions: PartitionService,
    private readonly catalog: CheckCatalogService,
    private readonly db: Database,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.catalog.seed();
    await this.maintenance.upsertJobScheduler(
      'ensure-partitions-daily',
      { pattern: '0 1 * * *' },
      { name: MAINTENANCE_JOBS.ENSURE_PARTITIONS, opts: DEFAULT_JOB_OPTIONS },
    );
    await this.maintenance.upsertJobScheduler(
      'reconcile-schedules-hourly',
      { pattern: '15 * * * *' },
      { name: MAINTENANCE_JOBS.RECONCILE_SCHEDULES, opts: DEFAULT_JOB_OPTIONS },
    );
    // Every 5 min, recover crawls whose finalize died and left them stuck.
    await this.maintenance.upsertJobScheduler(
      'reap-stuck-crawls',
      { every: 5 * 60 * 1000 },
      { name: MAINTENANCE_JOBS.REAP_STUCK_CRAWLS, opts: DEFAULT_JOB_OPTIONS },
    );
    await this.partitions.ensurePartitions();
    await this.schedulerSync.reconcile();
    // Immediately on startup, sweep up anything a previous interrupted run left
    // stuck — this is exactly when a finalize is most likely to have been killed.
    await this.maintenance.add(MAINTENANCE_JOBS.REAP_STUCK_CRAWLS, {}, DEFAULT_JOB_OPTIONS);
  }

  async onApplicationShutdown(): Promise<void> {
    // BullMQ workers/queues are closed by @nestjs/bullmq on shutdown; close the
    // shared Redis command connection and the DB pool so no handles linger.
    this.redis.disconnect();
    await this.db.close();
  }
}
