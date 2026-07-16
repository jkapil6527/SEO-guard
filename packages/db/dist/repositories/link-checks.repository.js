"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkChecksRepository = void 0;
class LinkChecksRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async insertMany(crawlId, websiteId, checks) {
        if (checks.length === 0)
            return;
        const params = [crawlId, websiteId];
        const values = checks
            .map((c) => {
            params.push(c.url, c.urlHash, c.status, c.ok, c.isInternal, c.redirectHops, c.error);
            const n = params.length;
            return `($1,$2,$${n - 6},$${n - 5},$${n - 4},$${n - 3},$${n - 2},$${n - 1},$${n})`;
        })
            .join(', ');
        await this.db.query(`INSERT INTO link_checks (crawl_id, website_id, url, url_hash, status, ok, is_internal, redirect_hops, error)
       VALUES ${values}
       ON CONFLICT (crawl_id, url_hash) DO NOTHING`, params);
    }
    countBroken(crawlId) {
        return this.db.queryOne(`SELECT count(*)::int AS count FROM link_checks WHERE crawl_id = $1 AND NOT ok`, [crawlId]);
    }
}
exports.LinkChecksRepository = LinkChecksRepository;
//# sourceMappingURL=link-checks.repository.js.map