"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogsRepository = void 0;
const COLS = `id, user_id AS "userId", project_id AS "projectId", action, entity,
  entity_id AS "entityId", before, after, ip, created_at AS "createdAt"`;
class AuditLogsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async record(input) {
        await this.db.query(`INSERT INTO audit_logs (user_id, project_id, action, entity, entity_id, before, after, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            input.userId,
            input.projectId,
            input.action,
            input.entity ?? null,
            input.entityId ?? null,
            input.before ? JSON.stringify(input.before) : null,
            input.after ? JSON.stringify(input.after) : null,
            input.ip ?? null,
        ]);
    }
    listByProject(projectId, limit, beforeId) {
        if (beforeId !== undefined) {
            return this.db.query(`SELECT ${COLS} FROM audit_logs WHERE project_id = $1 AND id < $2
         ORDER BY id DESC LIMIT $3`, [projectId, beforeId, limit]);
        }
        return this.db.query(`SELECT ${COLS} FROM audit_logs WHERE project_id = $1 ORDER BY id DESC LIMIT $2`, [projectId, limit]);
    }
}
exports.AuditLogsRepository = AuditLogsRepository;
//# sourceMappingURL=audit-logs.repository.js.map