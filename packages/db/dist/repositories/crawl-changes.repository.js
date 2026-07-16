"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlChangesRepository = void 0;
const COLS = `c.id, c.crawl_id AS "crawlId", c.website_id AS "websiteId", c.page_id AS "pageId",
  c.change_type AS "changeType", c.severity, c.before, c.after, c.created_at AS "createdAt"`;
class CrawlChangesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async insertMany(crawlId, websiteId, changes) {
        const CHUNK = 500;
        let inserted = 0;
        for (let i = 0; i < changes.length; i += CHUNK) {
            const chunk = changes.slice(i, i + CHUNK);
            const params = [crawlId, websiteId];
            const values = chunk
                .map((c) => {
                params.push(c.pageId, c.changeType, c.severity, c.before === undefined ? null : JSON.stringify(c.before), c.after === undefined ? null : JSON.stringify(c.after));
                const n = params.length;
                return `($1,$2,$${n - 4},$${n - 3},$${n - 2}::issue_severity,$${n - 1},$${n})`;
            })
                .join(', ');
            await this.db.query(`INSERT INTO crawl_changes (crawl_id, website_id, page_id, change_type, severity, before, after)
         VALUES ${values}`, params);
            inserted += chunk.length;
        }
        return inserted;
    }
    listByCrawl(crawlId, opts) {
        const params = [crawlId];
        let where = `c.crawl_id = $1`;
        if (opts.changeType) {
            params.push(opts.changeType);
            where += ` AND c.change_type = $${params.length}`;
        }
        if (opts.changeTypes?.length) {
            params.push(opts.changeTypes);
            where += ` AND c.change_type = ANY($${params.length})`;
        }
        if (opts.severity?.length) {
            params.push(opts.severity);
            where += ` AND c.severity = ANY($${params.length}::issue_severity[])`;
        }
        if (opts.cursor) {
            params.push(opts.cursor.createdAt, opts.cursor.id);
            where += ` AND (c.created_at, c.id) > ($${params.length - 1}, $${params.length})`;
        }
        params.push(opts.limit);
        return this.db.query(`SELECT ${COLS}, p.url FROM crawl_changes c LEFT JOIN pages p ON p.id = c.page_id
       WHERE ${where} ORDER BY c.created_at, c.id LIMIT $${params.length}`, params);
    }
    summary(crawlId) {
        return this.db.query(`SELECT change_type AS "changeType", count(*)::int AS count
       FROM crawl_changes WHERE crawl_id = $1 GROUP BY change_type ORDER BY count DESC`, [crawlId]);
    }
}
exports.CrawlChangesRepository = CrawlChangesRepository;
//# sourceMappingURL=crawl-changes.repository.js.map