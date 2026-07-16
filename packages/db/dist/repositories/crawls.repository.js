"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlsRepository = void 0;
const COLS = `id, website_id AS "websiteId", status, trigger, mode, scope,
  target_url AS "targetUrl", sitemap_group_id AS "sitemapGroupId",
  rule_pack_version AS "rulePackVersion", stats, error,
  started_at AS "startedAt", finished_at AS "finishedAt", created_by AS "createdBy",
  created_at AS "createdAt"`;
const ACTIVE_STATUSES = ['queued', 'resolving', 'running', 'paused', 'finalizing'];
class CrawlsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        return this.db.queryOne(`SELECT ${COLS} FROM crawls WHERE id = $1`, [id]);
    }
    /** A single crawl joined to its website/project/group, for the detail header. */
    findReportById(id) {
        return this.db.queryOne(`SELECT c.id, c.website_id AS "websiteId", c.status, c.trigger, c.mode, c.scope,
              c.target_url AS "targetUrl", c.sitemap_group_id AS "sitemapGroupId",
              c.rule_pack_version AS "rulePackVersion", c.stats,
              c.error, c.started_at AS "startedAt", c.finished_at AS "finishedAt",
              c.created_by AS "createdBy", c.created_at AS "createdAt",
              w.name AS "websiteName", w.origin AS "websiteOrigin",
              p.id AS "projectId", p.name AS "projectName", p.slug AS "projectSlug",
              g.name AS "groupName",
              a.seo_score AS "seoScore"
         FROM crawls c
         JOIN websites w ON w.id = c.website_id
         JOIN projects p ON p.id = w.project_id
         LEFT JOIN sitemap_groups g ON g.id = c.sitemap_group_id
         LEFT JOIN crawl_aggregates a ON a.crawl_id = c.id
        WHERE c.id = $1`, [id]);
    }
    /**
     * Crawls that are effectively done but stuck: either sitting in 'finalizing'
     * (the finalize job died mid-run and no retry re-drove it), or still 'running'
     * with every page settled but finalize never completed. Bounded by a staleness
     * window so a genuinely-active crawl at 100% for a few seconds isn't disturbed.
     */
    findStuckFinalizing(staleBefore) {
        return this.db.query(`SELECT ${COLS} FROM crawls
        WHERE finished_at IS NULL
          AND created_at < $1
          AND (
            status = 'finalizing'
            OR (
              status = 'running'
              AND coalesce((stats->>'total')::int, 0) > 0
              AND coalesce((stats->>'crawled')::int, 0)
                + coalesce((stats->>'unchanged')::int, 0)
                + coalesce((stats->>'failed')::int, 0)
                >= coalesce((stats->>'total')::int, 0)
            )
          )
        ORDER BY created_at ASC`, [staleBefore]);
    }
    listByWebsite(websiteId, limit, beforeCreatedAt) {
        if (beforeCreatedAt) {
            return this.db.query(`SELECT ${COLS} FROM crawls WHERE website_id = $1 AND created_at < $2
         ORDER BY created_at DESC LIMIT $3`, [websiteId, beforeCreatedAt, limit]);
        }
        return this.db.query(`SELECT ${COLS} FROM crawls WHERE website_id = $1 ORDER BY created_at DESC LIMIT $2`, [websiteId, limit]);
    }
    /**
     * An in-flight crawl blocking a new one.
     *
     * Scoped to the sitemap group when one is given: the categories of a website
     * are independent, so a running "Model Pages" crawl must not block "Compare
     * Pages". A website-wide crawl (no group) still conflicts with everything,
     * since it covers all of them.
     */
    findActiveForScope(websiteId, sitemapGroupId) {
        if (sitemapGroupId) {
            return this.db.queryOne(`SELECT ${COLS} FROM crawls
          WHERE website_id = $1 AND status = ANY($2)
            AND (sitemap_group_id = $3 OR sitemap_group_id IS NULL)
          ORDER BY created_at DESC LIMIT 1`, [websiteId, ACTIVE_STATUSES, sitemapGroupId]);
        }
        return this.db.queryOne(`SELECT ${COLS} FROM crawls WHERE website_id = $1 AND status = ANY($2)
       ORDER BY created_at DESC LIMIT 1`, [websiteId, ACTIVE_STATUSES]);
    }
    /**
     * Latest fully completed crawl before the given one — the diff/incremental
     * baseline. Must match on group, or an incremental "Model Pages" crawl would
     * baseline against the last "Compare Pages" crawl and diff two unrelated URL
     * sets against each other.
     */
    findPreviousCompleted(websiteId, beforeCrawlId, sitemapGroupId) {
        if (sitemapGroupId) {
            return this.db.queryOne(`SELECT ${COLS} FROM crawls
          WHERE website_id = $1 AND status = 'completed' AND sitemap_group_id = $3
            AND created_at < (SELECT created_at FROM crawls WHERE id = $2)
          ORDER BY created_at DESC LIMIT 1`, [websiteId, beforeCrawlId, sitemapGroupId]);
        }
        return this.db.queryOne(`SELECT ${COLS} FROM crawls
       WHERE website_id = $1 AND status = 'completed' AND sitemap_group_id IS NULL
         AND created_at < (SELECT created_at FROM crawls WHERE id = $2)
       ORDER BY created_at DESC LIMIT 1`, [websiteId, beforeCrawlId]);
    }
    /**
     * Crawls across every website, newest first — the workspace-wide report feed.
     * Left-joins the aggregate so in-flight crawls (which have no score yet) still
     * appear, and optionally narrows to one project.
     */
    listAll(limit, beforeCreatedAt, projectId) {
        // Crawls of a deleted project stay in the table (history is immutable) but
        // must not surface in the feed, matching every other project-scoped read.
        const conditions = ['p.deleted_at IS NULL'];
        const params = [];
        if (beforeCreatedAt) {
            params.push(beforeCreatedAt);
            conditions.push(`c.created_at < $${params.length}`);
        }
        if (projectId) {
            params.push(projectId);
            conditions.push(`p.id = $${params.length}`);
        }
        params.push(limit);
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        return this.db.query(`SELECT c.id, c.website_id AS "websiteId", c.status, c.trigger, c.mode, c.scope,
              c.target_url AS "targetUrl", c.sitemap_group_id AS "sitemapGroupId",
              c.rule_pack_version AS "rulePackVersion", c.stats,
              c.error, c.started_at AS "startedAt", c.finished_at AS "finishedAt",
              c.created_by AS "createdBy", c.created_at AS "createdAt",
              w.name AS "websiteName", w.origin AS "websiteOrigin",
              p.id AS "projectId", p.name AS "projectName", p.slug AS "projectSlug",
              g.name AS "groupName",
              a.seo_score AS "seoScore"
         FROM crawls c
         JOIN websites w ON w.id = c.website_id
         JOIN projects p ON p.id = w.project_id
         LEFT JOIN sitemap_groups g ON g.id = c.sitemap_group_id
         LEFT JOIN crawl_aggregates a ON a.crawl_id = c.id
         ${where}
        ORDER BY c.created_at DESC
        LIMIT $${params.length}`, params);
    }
    async create(input) {
        const row = await this.db.queryOne(`INSERT INTO crawls (website_id, trigger, mode, scope, target_url, sitemap_group_id,
                           rule_pack_version, created_by)
       VALUES ($1, $2::crawl_trigger, $3, $4, $5, $6, $7, $8) RETURNING ${COLS}`, [
            input.websiteId,
            input.trigger,
            input.mode,
            input.scope,
            input.targetUrl,
            input.sitemapGroupId ?? null,
            input.rulePackVersion,
            input.createdBy,
        ]);
        if (!row)
            throw new Error('insert returned no row');
        return row;
    }
    async setStatus(id, status, patch) {
        await this.db.query(`UPDATE crawls SET
         status = $2::crawl_status,
         error = COALESCE($3, error),
         started_at = CASE WHEN $2 = 'running' AND started_at IS NULL THEN now() ELSE started_at END,
         finished_at = CASE WHEN $2 IN ('completed','failed','cancelled') THEN now() ELSE finished_at END
       WHERE id = $1`, [id, status, patch?.error ?? null]);
    }
    async updateStats(id, stats) {
        await this.db.query(`UPDATE crawls SET stats = $2 WHERE id = $1`, [id, JSON.stringify(stats)]);
    }
}
exports.CrawlsRepository = CrawlsRepository;
//# sourceMappingURL=crawls.repository.js.map