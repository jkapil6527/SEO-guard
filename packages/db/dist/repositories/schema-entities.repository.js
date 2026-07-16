"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaEntitiesRepository = void 0;
const COLS = `e.id, e.crawl_id AS "crawlId", e.snapshot_id AS "snapshotId", e.page_id AS "pageId",
  e.website_id AS "websiteId", e.format, e.schema_type AS "schemaType", e.status,
  e.properties, e.validation, e.rich_results AS "richResults", e.confidence,
  e.created_at AS "createdAt"`;
class SchemaEntitiesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    listByCrawl(crawlId, opts) {
        const params = [crawlId];
        let where = `e.crawl_id = $1`;
        if (opts.schemaType) {
            params.push(opts.schemaType);
            where += ` AND e.schema_type = $${params.length}`;
        }
        if (opts.status) {
            params.push(opts.status);
            where += ` AND e.status = $${params.length}`;
        }
        if (opts.format) {
            params.push(opts.format);
            where += ` AND e.format = $${params.length}`;
        }
        if (opts.cursor) {
            params.push(opts.cursor.createdAt, opts.cursor.id);
            where += ` AND (e.created_at, e.id) > ($${params.length - 1}, $${params.length})`;
        }
        params.push(opts.limit);
        return this.db.query(`SELECT ${COLS}, p.url FROM schema_entities e JOIN pages p ON p.id = e.page_id
       WHERE ${where} ORDER BY e.created_at, e.id LIMIT $${params.length}`, params);
    }
    listByPage(crawlId, pageId) {
        return this.db.query(`SELECT ${COLS}, p.url FROM schema_entities e JOIN pages p ON p.id = e.page_id
       WHERE e.crawl_id = $1 AND e.page_id = $2 ORDER BY e.schema_type`, [crawlId, pageId]);
    }
    typeFrequency(crawlId) {
        return this.db.query(`SELECT schema_type AS "schemaType", count(*)::int AS count
       FROM schema_entities WHERE crawl_id = $1 GROUP BY schema_type ORDER BY count DESC`, [crawlId]);
    }
    statusCounts(crawlId) {
        return this.db.query(`SELECT status, count(*)::int AS count FROM schema_entities
       WHERE crawl_id = $1 GROUP BY status`, [crawlId]);
    }
    /** Coverage: total entities, and how many distinct pages carry any schema. */
    async coverage(crawlId) {
        const row = await this.db.queryOne(`SELECT count(*)::int AS "totalEntities",
              count(DISTINCT page_id)::int AS "pagesWithSchema",
              count(*) FILTER (
                WHERE rich_results @> '[{"status":"eligible"}]'
                   OR rich_results @> '[{"status":"eligible_with_warnings"}]'
              )::int AS "richEligible"
       FROM schema_entities WHERE crawl_id = $1`, [crawlId]);
        return row ?? { totalEntities: 0, pagesWithSchema: 0, richEligible: 0 };
    }
    /** Rich-result eligibility rollup by profile across a crawl. */
    richResultSummary(crawlId) {
        return this.db.query(`SELECT rr ->> 'profile' AS profile, rr ->> 'status' AS status, count(*)::int AS count
       FROM schema_entities e
       CROSS JOIN LATERAL jsonb_array_elements(coalesce(e.rich_results, '[]'::jsonb)) AS rr
       WHERE e.crawl_id = $1
       GROUP BY rr ->> 'profile', rr ->> 'status'
       ORDER BY profile, status`, [crawlId]);
    }
    /** Distinct page ids that have any schema entity in the crawl. Cheap — no jsonb. */
    async pageIdsWithSchema(crawlId) {
        const rows = await this.db.query(`SELECT DISTINCT page_id AS "pageId" FROM schema_entities WHERE crawl_id = $1`, [crawlId]);
        return rows.map((r) => r.pageId);
    }
    /**
     * Per-page summaries for diffing a crawl against its predecessor, restricted to
     * a page batch so finalize never has to hold a whole crawl's structured data in
     * memory at once (a single large site can carry hundreds of MB of `properties`).
     *
     * Any single entity whose `properties` exceeds `maxPropertyBytes` is returned
     * with empty properties: such blobs are extraction artifacts (e.g. a whole
     * document captured as one value), not meaningfully diffable, and decoding them
     * into JS is exactly what exhausts the heap. The entity still diffs by hash, so
     * add/remove/modified detection is unaffected — only its property-level detail
     * is skipped.
     */
    loadSummariesForPages(crawlId, pageIds, maxPropertyBytes = 262144) {
        if (pageIds.length === 0)
            return Promise.resolve([]);
        return this.db.query(`SELECT e.page_id AS "pageId", p.url, e.schema_type AS "schemaType", e.format, e.status,
              e.identity, encode(e.entity_hash, 'hex') AS "entityHash",
              CASE WHEN pg_column_size(e.properties) > $3 THEN '{}'::jsonb ELSE e.properties END
                AS "properties",
              e.rich_results AS "richResults"
       FROM schema_entities e JOIN pages p ON p.id = e.page_id
       WHERE e.crawl_id = $1 AND e.page_id = ANY($2)`, [crawlId, pageIds, maxPropertyBytes]);
    }
    /** Copies a previous snapshot's schema entities onto a carried-forward snapshot. */
    async copyForCarryForward(fromCrawlId, fromSnapshotId, to) {
        const rows = await this.db.query(`INSERT INTO schema_entities
         (crawl_id, snapshot_id, page_id, website_id, format, schema_type, status, identity,
          properties, validation, rich_results, entity_hash, confidence)
       SELECT $3, $4, $5, $6, format, schema_type, status, identity, properties, validation,
              rich_results, entity_hash, confidence
       FROM schema_entities WHERE crawl_id = $1 AND snapshot_id = $2
       RETURNING id`, [fromCrawlId, fromSnapshotId, to.crawlId, to.snapshotId, to.pageId, to.websiteId]);
        return rows.length;
    }
}
exports.SchemaEntitiesRepository = SchemaEntitiesRepository;
//# sourceMappingURL=schema-entities.repository.js.map