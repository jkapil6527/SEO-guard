import { Database } from '@seo-guardian/db';
import { JobsService } from '../jobs/jobs.service';
export declare class HealthController {
    private readonly db;
    private readonly jobs;
    constructor(db: Database, jobs: JobsService);
    health(): {
        status: string;
    };
    ready(): Promise<{
        status: string;
        database: string;
        redis: string;
    }>;
}
