import { Database } from '@seo-guardian/db';
/** Keeps monthly partitions provisioned ahead of time (see docs/03-database.md §4). */
export declare class PartitionService {
    private readonly db;
    private readonly logger;
    constructor(db: Database);
    ensurePartitions(): Promise<number>;
}
