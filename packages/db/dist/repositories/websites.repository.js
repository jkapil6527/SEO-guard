"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsitesRepository = void 0;
const COLS = `id, project_id AS "projectId", name, origin, path_scope AS "pathScope",
  settings, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`;
class WebsitesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        return this.db.queryOne(`SELECT ${COLS} FROM websites WHERE id = $1`, [id]);
    }
    listByProject(projectId) {
        return this.db.query(`SELECT ${COLS} FROM websites WHERE project_id = $1 ORDER BY name`, [projectId]);
    }
    async create(input) {
        const row = await this.db.queryOne(`INSERT INTO websites (project_id, name, origin, path_scope, settings)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLS}`, [
            input.projectId,
            input.name,
            input.origin,
            input.pathScope ?? '/',
            JSON.stringify(input.settings ?? {}),
        ]);
        if (!row)
            throw new Error('insert returned no row');
        return row;
    }
    update(id, patch) {
        return this.db.queryOne(`UPDATE websites SET
         name = COALESCE($2, name),
         settings = COALESCE($3, settings),
         is_active = COALESCE($4, is_active),
         updated_at = now()
       WHERE id = $1 RETURNING ${COLS}`, [
            id,
            patch.name ?? null,
            patch.settings ? JSON.stringify(patch.settings) : null,
            patch.isActive ?? null,
        ]);
    }
    async delete(id) {
        const rows = await this.db.query(`DELETE FROM websites WHERE id = $1 RETURNING id`, [id]);
        return rows.length > 0;
    }
    /** Resolves the owning project for RBAC checks on nested resources. */
    async projectIdOf(websiteId) {
        const row = await this.db.queryOne(`SELECT project_id AS "projectId" FROM websites WHERE id = $1`, [websiteId]);
        return row?.projectId ?? null;
    }
}
exports.WebsitesRepository = WebsitesRepository;
//# sourceMappingURL=websites.repository.js.map