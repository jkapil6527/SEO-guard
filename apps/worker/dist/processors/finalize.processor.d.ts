import { WorkerHost } from '@nestjs/bullmq';
import { CrawlAggregatesRepository, CrawlChangesRepository, CrawlsRepository, LinkChecksRepository, PageIssuesRepository, SchemaEntitiesRepository } from '@seo-guardian/db';
import type { FinalizeJobData } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import { CrawlStateService } from '../infra/crawl-state.service';
/**
 * Runs once per crawl when all pages settle: waits for link verification to
 * drain, computes cross-page duplicate and broken-link issues in SQL, derives
 * the site score and dashboard aggregates, and marks the crawl completed.
 * Idempotent — safe to re-run (aggregates upsert; duplicate/broken issues are
 * cleared first).
 */
export declare class FinalizeProcessor extends WorkerHost {
    private readonly crawls;
    private readonly issues;
    private readonly linkChecks;
    private readonly aggregates;
    private readonly schemaEntities;
    private readonly changes;
    private readonly state;
    private readonly logger;
    constructor(crawls: CrawlsRepository, issues: PageIssuesRepository, linkChecks: LinkChecksRepository, aggregates: CrawlAggregatesRepository, schemaEntities: SchemaEntitiesRepository, changes: CrawlChangesRepository, state: CrawlStateService);
    process(job: Job<FinalizeJobData>, token?: string): Promise<unknown>;
    /**
     * Diffs this crawl's schema entities against the previous completed crawl,
     * per page, and records the changes. First crawl of a website has no baseline.
     */
    private detectSchemaChanges;
    private computeAggregates;
}
