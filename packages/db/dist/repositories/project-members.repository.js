"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectMembersRepository = void 0;
class ProjectMembersRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findRole(projectId, userId) {
        return this.db.queryOne(`SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`, [projectId, userId]);
    }
    list(projectId) {
        return this.db.query(`SELECT m.project_id AS "projectId", m.user_id AS "userId", m.role,
              m.created_at AS "createdAt", u.email, u.name
       FROM project_members m JOIN users u ON u.id = m.user_id
       WHERE m.project_id = $1 ORDER BY u.name`, [projectId]);
    }
    listForUser(userId) {
        return this.db.query(`SELECT project_id AS "projectId", role FROM project_members WHERE user_id = $1`, [userId]);
    }
    async upsert(projectId, userId, role) {
        const row = await this.db.queryOne(`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3::project_role)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING project_id AS "projectId", user_id AS "userId", role, created_at AS "createdAt"`, [projectId, userId, role]);
        if (!row)
            throw new Error('upsert returned no row');
        return row;
    }
    async remove(projectId, userId) {
        const rows = await this.db.query(`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING user_id`, [projectId, userId]);
        return rows.length > 0;
    }
    async countAdmins(projectId) {
        const row = await this.db.queryOne(`SELECT count(*)::int AS count FROM project_members WHERE project_id = $1 AND role = 'admin'`, [projectId]);
        return row?.count ?? 0;
    }
}
exports.ProjectMembersRepository = ProjectMembersRepository;
//# sourceMappingURL=project-members.repository.js.map