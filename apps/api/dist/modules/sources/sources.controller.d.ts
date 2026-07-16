import type { AuthUser } from '../../common/auth-user';
import { SourcesService } from './sources.service';
declare class SetActiveDto {
    isActive: boolean;
}
export declare class SourcesController {
    private readonly sourcesService;
    constructor(sourcesService: SourcesService);
    list(websiteId: string): Promise<{
        data: import("@seo-guardian/db").UrlSourceRow[];
        meta: {
            nextCursor: null;
        };
    }>;
    create(websiteId: string, body: Record<string, unknown>, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").UrlSourceRow>;
    uploadCsv(websiteId: string, file: Express.Multer.File | undefined, urlColumn: string | undefined, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").UrlSourceRow>;
    setActive(sourceId: string, dto: SetActiveDto, actor: AuthUser, ip: string): Promise<import("@seo-guardian/db").UrlSourceRow>;
    remove(sourceId: string, actor: AuthUser, ip: string): Promise<void>;
}
export {};
