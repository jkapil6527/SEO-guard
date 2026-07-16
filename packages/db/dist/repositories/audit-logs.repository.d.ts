import type { Database } from '../database';
export interface AuditLogRow {
    id: number;
    userId: string | null;
    projectId: string | null;
    action: string;
    entity: string | null;
    entityId: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    ip: string | null;
    createdAt: Date;
}
export declare class AuditLogsRepository {
    private readonly db;
    constructor(db: Database);
    record(input: {
        userId: string | null;
        projectId: string | null;
        action: string;
        entity?: string;
        entityId?: string;
        before?: Record<string, unknown> | null;
        after?: Record<string, unknown> | null;
        ip?: string | null;
    }): Promise<void>;
    listByProject(projectId: string, limit: number, beforeId?: number): Promise<AuditLogRow[]>;
}
