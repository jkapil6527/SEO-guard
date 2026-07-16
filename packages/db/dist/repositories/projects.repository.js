"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsRepository = void 0;
const COLS = `id, name, slug, settings, created_by AS "createdBy",
  deleted_at AS "deletedAt", created_at AS "createdAt", updated_at AS "updatedAt"`;
class ProjectsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        return this.db.queryOne(`SELECT ${COLS} FROM projects WHERE id = $1 AND deleted_at IS NULL`, [id]);
    }
    findBySlug(slug) {
        return this.db.queryOne(`SELECT ${COLS} FROM projects WHERE slug = $1 AND deleted_at IS NULL`, [slug]);
    }
    /** Projects visible to a user: all for super admins, memberships otherwise. */
    listForUser(userId, isSuperAdmin) {
        if (isSuperAdmin) {
            return this.db.query(`SELECT ${COLS} FROM projects WHERE deleted_at IS NULL ORDER BY name`);
        }
        return this.db.query(`SELECT ${COLS} FROM projects p
       WHERE deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $1)
       ORDER BY name`, [userId]);
    }
    /** Creates the project and grants the creator the admin membership atomically. */
    async createWithOwner(input) {
        return this.db.transaction(async (client) => {
            const res = await client.query(`INSERT INTO projects (name, slug, settings, created_by)
         VALUES ($1, $2, $3, $4) RETURNING ${COLS}`, [input.name, input.slug, JSON.stringify(input.settings ?? {}), input.createdBy]);
            const project = res.rows[0];
            if (!project)
                throw new Error('insert returned no row');
            await client.query(`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'admin')`, [project.id, input.createdBy]);
            return project;
        });
    }
    update(id, patch) {
        return this.db.queryOne(`UPDATE projects SET
         name = COALESCE($2, name),
         settings = COALESCE($3, settings),
         updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLS}`, [id, patch.name ?? null, patch.settings ? JSON.stringify(patch.settings) : null]);
    }
    softDelete(id) {
        return this.db.queryOne(`UPDATE projects SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLS}`, [id]);
    }
}
exports.ProjectsRepository = ProjectsRepository;
//# sourceMappingURL=projects.repository.js.map