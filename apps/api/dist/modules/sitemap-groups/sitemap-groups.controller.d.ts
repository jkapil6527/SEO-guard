import type { SitemapGroupRow, SitemapGroupSummaryRow } from '@seo-guardian/db';
import type { AuthUser } from '../../common/auth-user';
import { CreateSitemapGroupDto, PreviewSitemapDto, StartGroupCrawlDto, UpdateSitemapGroupDto } from './sitemap-groups.dto';
import { SitemapGroupsService } from './sitemap-groups.service';
export declare class SitemapGroupsController {
    private readonly service;
    constructor(service: SitemapGroupsService);
    list(projectId: string): Promise<{
        data: SitemapGroupSummaryRow[];
    }>;
    create(_projectId: string, dto: CreateSitemapGroupDto, actor: AuthUser): Promise<SitemapGroupRow>;
    get(groupId: string): Promise<SitemapGroupRow>;
    trend(groupId: string): Promise<{
        data: Array<{
            day: Date;
            seoScore: string;
        }>;
    }>;
    update(groupId: string, dto: UpdateSitemapGroupDto): Promise<SitemapGroupRow>;
    remove(groupId: string): Promise<void>;
    preview(groupId: string, dto: PreviewSitemapDto): Promise<import("./sitemap-groups.service").SitemapPreview>;
    startCrawl(groupId: string, dto: StartGroupCrawlDto, actor: AuthUser, ip: string): Promise<{
        crawlId: string;
        status: string;
    }>;
}
