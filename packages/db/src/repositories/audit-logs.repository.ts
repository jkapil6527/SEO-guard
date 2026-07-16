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

const COLS = `id, user_id AS "userId", project_id AS "projectId", action, entity,
  entity_id AS "entityId", before, after, ip, created_at AS "createdAt"`;

export class AuditLogsRepository {
  constructor(private readonly db: Database) {}

  async record(input: {
    userId: string | null;
    projectId: string | null;
    action: string;
    entity?: string;
    entityId?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ip?: string | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_logs (user_id, project_id, action, entity, entity_id, before, after, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.userId,
        input.projectId,
        input.action,
        input.entity ?? null,
        input.entityId ?? null,
        input.before ? JSON.stringify(input.before) : null,
        input.after ? JSON.stringify(input.after) : null,
        input.ip ?? null,
      ],
    );
  }

  listByProject(projectId: string, limit: number, beforeId?: number): Promise<AuditLogRow[]> {
    if (beforeId !== undefined) {
      return this.db.query<AuditLogRow>(
        `SELECT ${COLS} FROM audit_logs WHERE project_id = $1 AND id < $2
         ORDER BY id DESC LIMIT $3`,
        [projectId, beforeId, limit],
      );
    }
    return this.db.query<AuditLogRow>(
      `SELECT ${COLS} FROM audit_logs WHERE project_id = $1 ORDER BY id DESC LIMIT $2`,
      [projectId, limit],
    );
  }
}
