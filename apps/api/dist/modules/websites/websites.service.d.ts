import { WebsitesRepository } from '@seo-guardian/db';
import type { WebsiteRow } from '@seo-guardian/db';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import type { CreateWebsiteDto, UpdateWebsiteDto } from './websites.dto';
interface ActorContext {
    actor: AuthUser;
    ip: string | null;
}
export declare class WebsitesService {
    private readonly websites;
    private readonly audit;
    constructor(websites: WebsitesRepository, audit: AuditService);
    list(projectId: string): Promise<WebsiteRow[]>;
    getById(id: string): Promise<WebsiteRow>;
    create(projectId: string, dto: CreateWebsiteDto, ctx: ActorContext): Promise<WebsiteRow>;
    update(id: string, dto: UpdateWebsiteDto, ctx: ActorContext): Promise<WebsiteRow>;
    delete(id: string, ctx: ActorContext): Promise<void>;
}
export {};
