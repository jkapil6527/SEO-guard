"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlSourcesRepository = void 0;
const COLS = `id, website_id AS "websiteId", type, config, is_active AS "isActive",
  created_by AS "createdBy", created_at AS "createdAt"`;
class UrlSourcesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        return this.db.queryOne(`SELECT ${COLS} FROM url_sources WHERE id = $1`, [id]);
    }
    listByWebsite(websiteId) {
        return this.db.query(`SELECT ${COLS} FROM url_sources WHERE website_id = $1 ORDER BY created_at DESC`, [websiteId]);
    }
    async create(input) {
        const row = await this.db.queryOne(`INSERT INTO url_sources (website_id, type, config, created_by)
       VALUES ($1, $2::url_source_type, $3, $4) RETURNING ${COLS}`, [input.websiteId, input.type, JSON.stringify(input.config), input.createdBy]);
        if (!row)
            throw new Error('insert returned no row');
        return row;
    }
    setActive(id, isActive) {
        return this.db.queryOne(`UPDATE url_sources SET is_active = $2 WHERE id = $1 RETURNING ${COLS}`, [id, isActive]);
    }
    async delete(id) {
        const rows = await this.db.query(`DELETE FROM url_sources WHERE id = $1 RETURNING id`, [id]);
        return rows.length > 0;
    }
    async websiteIdOf(sourceId) {
        const row = await this.db.queryOne(`SELECT website_id AS "websiteId" FROM url_sources WHERE id = $1`, [sourceId]);
        return row?.websiteId ?? null;
    }
}
exports.UrlSourcesRepository = UrlSourcesRepository;
//# sourceMappingURL=url-sources.repository.js.map