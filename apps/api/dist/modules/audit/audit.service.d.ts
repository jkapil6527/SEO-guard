import { AuditLogsRepository } from '@seo-guardian/db';
import type { AuditAction } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
export interface AuditEntry {
    actor: AuthUser;
    ip: string | null;
    projectId: string | null;
    action: AuditAction | string;
    entity: string;
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
}
/**
 * Records every create/update/delete. Failures are logged, never propagated:
 * an audit-log outage must not take down mutations, and the write path is
 * append-only so partial failure cannot corrupt state.
 */
export declare class AuditService {
    private readonly auditLogs;
    private readonly logger;
    constructor(auditLogs: AuditLogsRepository);
    record(entry: AuditEntry): Promise<void>;
}
