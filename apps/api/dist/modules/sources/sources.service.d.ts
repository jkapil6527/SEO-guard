import { UrlSourcesRepository, WebsitesRepository } from '@seo-guardian/db';
import type { UrlSourceRow } from '@seo-guardian/db';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CsvService } from './csv.service';
import { StorageService } from './storage.service';
import type { CreateDiscoverySourceDto, CreateManualSourceDto, CreateSitemapSourceDto } from './sources.dto';
interface ActorContext {
    actor: AuthUser;
    ip: string | null;
}
export declare class SourcesService {
    private readonly sources;
    private readonly websites;
    private readonly csv;
    private readonly storage;
    private readonly audit;
    constructor(sources: UrlSourcesRepository, websites: WebsitesRepository, csv: CsvService, storage: StorageService, audit: AuditService);
    list(websiteId: string): Promise<UrlSourceRow[]>;
    createManual(websiteId: string, dto: CreateManualSourceDto, ctx: ActorContext): Promise<UrlSourceRow>;
    createSitemap(websiteId: string, dto: CreateSitemapSourceDto, ctx: ActorContext): Promise<UrlSourceRow>;
    createDiscovery(websiteId: string, dto: CreateDiscoverySourceDto, ctx: ActorContext): Promise<UrlSourceRow>;
    createFromCsv(websiteId: string, file: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
    }, urlColumn: string, ctx: ActorContext): Promise<UrlSourceRow>;
    setActive(sourceId: string, isActive: boolean, ctx: ActorContext): Promise<UrlSourceRow>;
    delete(sourceId: string, ctx: ActorContext): Promise<void>;
    private getById;
    private create;
    private recordAudit;
}
export {};
