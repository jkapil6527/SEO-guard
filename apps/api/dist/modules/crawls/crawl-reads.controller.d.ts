import { CrawlAggregatesRepository, PageIssuesRepository, PageSnapshotsRepository } from '@seo-guardian/db';
import type { Paginated } from '@seo-guardian/shared';
import { CrawlIssueQueryDto, CrawlPageQueryDto } from './crawls.dto';
/** Read models over a crawl's snapshots, issues and aggregates. */
export declare class CrawlReadsController {
    private readonly snapshots;
    private readonly issues;
    private readonly aggregates;
    constructor(snapshots: PageSnapshotsRepository, issues: PageIssuesRepository, aggregates: CrawlAggregatesRepository);
    pages(crawlId: string, query: CrawlPageQueryDto): Promise<Paginated<unknown>>;
    page(crawlId: string, pageId: string): Promise<{
        snapshot: import("@seo-guardian/db").SnapshotRow;
        issues: {
            check: {
                name: string;
                category: import("@seo-guardian/seo-engine").CheckCategory | "schema";
                description: string;
                technicalExplanation: string;
                businessImpact: string;
                suggestedFix: string;
                docUrl: string | undefined;
                weight: number;
            } | null;
            duplicateOf: {
                sample: string;
                pageCount: number;
                urls: string[];
            } | null;
            id: string;
            crawlId: string;
            snapshotId: string;
            pageId: string;
            websiteId: string;
            checkId: string;
            severity: string;
            fingerprint: Buffer;
            evidence: Record<string, unknown>;
            createdAt: Date;
            url?: string;
        }[];
        duplicates: {
            field: string;
            sample: string;
            pageCount: number;
            urls: string[];
        }[];
    }>;
    duplicates(crawlId: string, field?: string): Promise<{
        data: Array<{
            field: string;
            sample: string;
            pageCount: number;
            urls: string[];
        }>;
    }>;
    issuesList(crawlId: string, query: CrawlIssueQueryDto): Promise<Paginated<unknown>>;
    issuesSummary(crawlId: string): Promise<{
        byCheck: {
            checkId: string;
            severity: string;
            count: number;
        }[];
        bySeverity: {
            severity: string;
            count: number;
        }[];
        aggregate: import("@seo-guardian/db").CrawlAggregateRow | null;
    }>;
    private paginate;
}
