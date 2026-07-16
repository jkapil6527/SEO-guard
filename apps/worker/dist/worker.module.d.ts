import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Database } from '@seo-guardian/db';
import type { Queue } from 'bullmq';
import { CheckCatalogService } from './crawl/check-catalog.service';
import { PartitionService } from './services/partition.service';
import { SchedulerSyncService } from './services/scheduler-sync.service';
export declare class WorkerModule implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly maintenance;
    private readonly redis;
    private readonly schedulerSync;
    private readonly partitions;
    private readonly catalog;
    private readonly db;
    constructor(maintenance: Queue, redis: Redis, schedulerSync: SchedulerSyncService, partitions: PartitionService, catalog: CheckCatalogService, db: Database);
    onApplicationBootstrap(): Promise<void>;
    onApplicationShutdown(): Promise<void>;
}
