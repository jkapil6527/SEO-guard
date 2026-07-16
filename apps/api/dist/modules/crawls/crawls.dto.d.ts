import { CrawlMode, CrawlScope, IssueSeverity } from '@seo-guardian/shared';
export declare class StartCrawlDto {
    mode?: CrawlMode;
    scope?: CrawlScope;
    url?: string;
    sitemapGroupId?: string;
}
export declare class CrawlReportQueryDto {
    limit?: number;
    cursor?: string;
    projectId?: string;
}
export declare class CrawlPageQueryDto {
    limit?: number;
    cursor?: string;
    fetchStatus?: string;
}
export declare class CrawlIssueQueryDto {
    limit?: number;
    cursor?: string;
    severity?: IssueSeverity[];
    checkId?: string;
}
