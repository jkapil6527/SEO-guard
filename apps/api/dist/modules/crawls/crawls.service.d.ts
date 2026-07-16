import { CrawlsRepository, PageIssuesRepository, PageSnapshotsRepository, WebsitesRepository } from '@seo-guardian/db';
import type { CrawlReportRow, CrawlRow } from '@seo-guardian/db';
import { CrawlMode, CrawlScope } from '@seo-guardian/shared';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CrawlProgressService } from './crawl-progress.service';
interface ActorContext {
    actor: AuthUser;
    ip: string | null;
}
export declare class CrawlsService {
    private readonly crawls;
    private readonly websites;
    private readonly snapshots;
    private readonly issues;
    private readonly progress;
    private readonly audit;
    private readonly orchestrateQueue;
    private readonly fetchQueue;
    constructor(crawls: CrawlsRepository, websites: WebsitesRepository, snapshots: PageSnapshotsRepository, issues: PageIssuesRepository, progress: CrawlProgressService, audit: AuditService, orchestrateQueue: Queue, fetchQueue: Queue);
    start(websiteId: string, mode: CrawlMode, scope: CrawlScope, url: string | undefined, ctx: ActorContext, sitemapGroupId?: string): Promise<CrawlRow>;
    /**
     * A page crawl must stay inside the website it belongs to — otherwise the URL
     * is an arbitrary fetch target chosen by the caller. The worker canonicalizes
     * the URL later; here we only enforce http(s) and a matching origin.
     */
    private resolvePageTarget;
    listAll(limit: number, beforeCreatedAt?: Date, projectId?: string): Promise<CrawlReportRow[]>;
    getStatus(crawlId: string): Promise<CrawlReportRow & {
        live: unknown;
    }>;
    history(websiteId: string, limit: number, beforeCreatedAt?: Date): Promise<CrawlRow[]>;
    pause(crawlId: string, ctx: ActorContext): Promise<void>;
    resume(crawlId: string, ctx: ActorContext): Promise<void>;
    cancel(crawlId: string, ctx: ActorContext): Promise<void>;
    retryFailed(crawlId: string, ctx: ActorContext): Promise<{
        requeued: number;
    }>;
    private assertControllable;
    private getById;
    private recordControl;
}
export {};
