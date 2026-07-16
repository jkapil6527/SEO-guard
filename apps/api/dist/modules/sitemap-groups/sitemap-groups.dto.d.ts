import { CrawlMode } from '@seo-guardian/shared';
export declare class CreateSitemapGroupDto {
    websiteId: string;
    name: string;
    sitemapUrl?: string;
}
export declare class UpdateSitemapGroupDto {
    name?: string;
    sitemapUrl?: string;
    isActive?: boolean;
}
export declare class PreviewSitemapDto {
    sitemapUrl?: string;
}
export declare class StartGroupCrawlDto {
    mode?: CrawlMode;
}
