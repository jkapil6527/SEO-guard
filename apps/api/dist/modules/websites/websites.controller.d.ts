import type { AuthUser } from '../../common/auth-user';
import { CreateWebsiteDto, UpdateWebsiteDto } from './websites.dto';
import { WebsitesService } from './websites.service';
export declare class WebsitesController {
    private readonly websitesService;
    constructor(websitesService: WebsitesService);
    list(projectId: string): Promise<{
        data: import("@seo-guardian/db").WebsiteRow[];
        meta: {
            nextCursor: null;
        };
    }>;
    create(projectId: string, dto: CreateWebsiteDto, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").WebsiteRow>;
    get(websiteId: string): Promise<import("@seo-guardian/db").WebsiteRow>;
    update(websiteId: string, dto: UpdateWebsiteDto, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").WebsiteRow>;
    remove(websiteId: string, actor: AuthUser, ip: string): Promise<void>;
}
