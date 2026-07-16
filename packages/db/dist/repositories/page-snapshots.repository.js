"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageSnapshotsRepository = void 0;
const COLS = `s.id, s.crawl_id AS "crawlId", s.page_id AS "pageId", s.website_id AS "websiteId",
  s.fetch_status AS "fetchStatus", s.http_status AS "httpStatus", s.redirect_chain AS "redirectChain",
  s.content_hash AS "contentHash", s.artifacts, s.score, s.issue_counts AS "issueCounts",
  s.rendered, s.created_at AS "createdAt"`;
class PageSnapshotsRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Idempotent persistence for at-least-once job delivery: any prior snapshot
     * for (crawl, page) and its issues are replaced in one transaction, so a
     * retried job cannot double-write.
     */
    async replaceSnapshot(snapshot, issues, schemaEntities = []) {
        return this.db.transaction(async (client) => {
            const prior = await client.query(`DELETE FROM page_snapshots WHERE crawl_id = $1 AND page_id = $2 RETURNING id`, [snapshot.crawlId, snapshot.pageId]);
            for (const row of prior.rows) {
                await client.query(`DELETE FROM page_issues WHERE crawl_id = $1 AND snapshot_id = $2`, [
                    snapshot.crawlId,
                    row.id,
                ]);
                await client.query(`DELETE FROM schema_entities WHERE crawl_id = $1 AND snapshot_id = $2`, [
                    snapshot.crawlId,
                    row.id,
                ]);
            }
            const inserted = await client.query(`INSERT INTO page_snapshots
           (crawl_id, page_id, website_id, fetch_status, http_status, redirect_chain,
            content_hash, artifacts, score, issue_counts, timing_ms, rendered)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`, [
                snapshot.crawlId,
                snapshot.pageId,
                snapshot.websiteId,
                snapshot.fetchStatus,
                snapshot.httpStatus,
                snapshot.redirectChain ? JSON.stringify(snapshot.redirectChain) : null,
                snapshot.contentHash,
                snapshot.artifacts ? JSON.stringify(snapshot.artifacts) : null,
                snapshot.score,
                JSON.stringify(snapshot.issueCounts),
                snapshot.timingMs ? JSON.stringify(snapshot.timingMs) : null,
                snapshot.rendered,
            ]);
            const snapshotId = inserted.rows[0].id;
            await this.insertIssues(client, snapshot, snapshotId, issues);
            await this.insertSchemaEntities(client, snapshot, snapshotId, schemaEntities);
            return { id: snapshotId, existed: prior.rows.length > 0 };
        });
    }
    async insertSchemaEntities(client, snapshot, snapshotId, entities) {
        for (const e of entities) {
            await client.query(`INSERT INTO schema_entities
           (crawl_id, snapshot_id, page_id, website_id, format, schema_type, status, identity,
            properties, validation, rich_results, entity_hash, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
                snapshot.crawlId,
                snapshotId,
                snapshot.pageId,
                snapshot.websiteId,
                e.format,
                e.schemaType,
                e.status,
                e.identity,
                JSON.stringify(e.properties ?? {}),
                JSON.stringify(e.validation ?? {}),
                e.richResults ? JSON.stringify(e.richResults) : null,
                e.entityHash,
                e.confidence,
            ]);
        }
    }
    async insertIssues(client, snapshot, snapshotId, issues) {
        const CHUNK = 500;
        for (let i = 0; i < issues.length; i += CHUNK) {
            const chunk = issues.slice(i, i + CHUNK);
            const params = [snapshot.crawlId, snapshotId, snapshot.pageId, snapshot.websiteId];
            const values = chunk
                .map((issue) => {
                params.push(issue.checkId, issue.severity, issue.fingerprint, JSON.stringify(issue.evidence));
                const n = params.length;
                return `($1,$2,$3,$4,$${n - 3},$${n - 2}::issue_severity,$${n - 1},$${n})`;
            })
                .join(', ');
            await client.query(`INSERT INTO page_issues
           (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
         VALUES ${values}`, params);
        }
    }
    /** Conditional-request hints for every page of a crawl (incremental baseline). */
    loadConditionalHints(crawlId) {
        return this.db.query(`SELECT s.page_id AS "pageId", s.id AS "snapshotId",
              s.artifacts ->> 'etag' AS "etag",
              s.artifacts ->> 'lastModified' AS "lastModified",
              s.content_hash AS "contentHash"
       FROM page_snapshots s WHERE s.crawl_id = $1 AND s.fetch_status IN ('ok','unchanged','carried_forward')`, [crawlId]);
    }
    findByCrawlAndPage(crawlId, pageId) {
        return this.db.queryOne(`SELECT ${COLS} FROM page_snapshots s WHERE s.crawl_id = $1 AND s.page_id = $2 LIMIT 1`, [crawlId, pageId]);
    }
    listByCrawl(crawlId, opts) {
        const params = [crawlId];
        let where = `s.crawl_id = $1`;
        if (opts.fetchStatus) {
            params.push(opts.fetchStatus);
            where += ` AND s.fetch_status = $${params.length}`;
        }
        if (opts.cursor) {
            params.push(opts.cursor.createdAt, opts.cursor.id);
            where += ` AND (s.created_at, s.id) > ($${params.length - 1}, $${params.length})`;
        }
        params.push(opts.limit);
        return this.db.query(`SELECT ${COLS}, p.url FROM page_snapshots s JOIN pages p ON p.id = s.page_id
       WHERE ${where} ORDER BY s.created_at, s.id LIMIT $${params.length}`, params);
    }
    /** Copies a previous snapshot's issues onto a carried-forward snapshot. */
    async copyIssues(fromCrawlId, fromSnapshotId, to) {
        const rows = await this.db.query(`INSERT INTO page_issues (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
       SELECT $3, $4, $5, $6, check_id, severity, fingerprint, evidence
       FROM page_issues WHERE crawl_id = $1 AND snapshot_id = $2
       RETURNING id`, [fromCrawlId, fromSnapshotId, to.crawlId, to.snapshotId, to.pageId, to.websiteId]);
        return rows.length;
    }
    /** Pages whose fetch errored — retry-failed re-enqueues exactly these. */
    listFailedPages(crawlId) {
        return this.db.query(`SELECT s.page_id AS "pageId", p.url
       FROM page_snapshots s JOIN pages p ON p.id = s.page_id
       WHERE s.crawl_id = $1 AND s.fetch_status = 'error'`, [crawlId]);
    }
}
exports.PageSnapshotsRepository = PageSnapshotsRepository;
//# sourceMappingURL=page-snapshots.repository.js.map