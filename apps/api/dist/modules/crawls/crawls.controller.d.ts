import type { CrawlProgressEvent, Paginated } from '@seo-guardian/shared';
import type { CrawlReportRow, CrawlRow } from '@seo-guardian/db';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../../common/auth-user';
import { CursorQueryDto } from '../../common/pagination';
import { CrawlProgressService } from './crawl-progress.service';
import { CrawlReportQueryDto, StartCrawlDto } from './crawls.dto';
import { CrawlsService } from './crawls.service';
export declare class CrawlsController {
    private readonly crawlsService;
    private readonly progress;
    constructor(crawlsService: CrawlsService, progress: CrawlProgressService);
    start(websiteId: string, dto: StartCrawlDto, actor: AuthUser, ip: string): Promise<{
        crawlId: string;
        status: string;
    }>;
    reports(query: CrawlReportQueryDto): Promise<Paginated<CrawlReportRow>>;
    history(websiteId: string, query: CursorQueryDto): Promise<Paginated<CrawlRow>>;
    status(crawlId: string): Promise<CrawlReportRow & {
        live: unknown;
    }>;
    progressStream(crawlId: string): Observable<{
        data: CrawlProgressEvent;
    }>;
    pause(crawlId: string, actor: AuthUser, ip: string): Promise<{
        status: string;
    }>;
    resume(crawlId: string, actor: AuthUser, ip: string): Promise<{
        status: string;
    }>;
    cancel(crawlId: string, actor: AuthUser, ip: string): Promise<{
        status: string;
    }>;
    retryFailed(crawlId: string, actor: AuthUser, ip: string): Promise<{
        requeued: number;
    }>;
}
