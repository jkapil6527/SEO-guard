import { AuditLogsRepository } from '@seo-guardian/db';
import type { AuditLogRow } from '@seo-guardian/db';
import type { Paginated } from '@seo-guardian/shared';
declare class AuditQueryDto {
    limit?: number;
    beforeId?: number;
}
export declare class AuditController {
    private readonly auditLogs;
    constructor(auditLogs: AuditLogsRepository);
    list(projectId: string, query: AuditQueryDto): Promise<Paginated<AuditLogRow>>;
}
export {};
