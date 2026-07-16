"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagesRepository = void 0;
class PagesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Bulk upsert of normalized URLs; returns id+url for every input. Uses a
     * single VALUES list per chunk — the orchestrator calls this with thousands
     * of URLs, so no row-at-a-time round trips.
     */
    async upsertMany(websiteId, entries) {
        const out = [];
        const CHUNK = 1_000;
        for (let i = 0; i < entries.length; i += CHUNK) {
            const chunk = entries.slice(i, i + CHUNK);
            const params = [websiteId];
            const values = chunk
                .map((e) => {
                params.push(e.url, e.urlHash);
                return `($1, $${params.length - 1}, $${params.length})`;
            })
                .join(', ');
            const rows = await this.db.query(`INSERT INTO pages (website_id, url, url_hash)
         VALUES ${values}
         ON CONFLICT (website_id, url_hash)
         DO UPDATE SET last_seen_at = now(), is_deleted = false
         RETURNING id, url`, params);
            out.push(...rows);
        }
        return out;
    }
    async upsertOne(websiteId, url, urlHash) {
        const rows = await this.upsertMany(websiteId, [{ url, urlHash }]);
        const row = rows[0];
        if (!row)
            throw new Error('upsert returned no row');
        return row;
    }
}
exports.PagesRepository = PagesRepository;
//# sourceMappingURL=pages.repository.js.map