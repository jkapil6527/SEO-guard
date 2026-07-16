"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageIssuesRepository = void 0;
const COLS = `i.id, i.crawl_id AS "crawlId", i.snapshot_id AS "snapshotId", i.page_id AS "pageId",
  i.website_id AS "websiteId", i.check_id AS "checkId", i.severity, i.fingerprint, i.evidence,
  i.created_at AS "createdAt"`;
class PageIssuesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    listByCrawl(crawlId, opts) {
        const params = [crawlId];
        let where = `i.crawl_id = $1`;
        if (opts.severity?.length) {
            params.push(opts.severity);
            where += ` AND i.severity = ANY($${params.length}::issue_severity[])`;
        }
        if (opts.checkId) {
            params.push(opts.checkId);
            where += ` AND i.check_id = $${params.length}`;
        }
        if (opts.cursor) {
            params.push(opts.cursor.createdAt, opts.cursor.id);
            where += ` AND (i.created_at, i.id) > ($${params.length - 1}, $${params.length})`;
        }
        params.push(opts.limit);
        return this.db.query(`SELECT ${COLS}, p.url FROM page_issues i JOIN pages p ON p.id = i.page_id
       WHERE ${where} ORDER BY i.created_at, i.id LIMIT $${params.length}`, params);
    }
    /** Every issue on one page, newest-severity-first. */
    listByPage(crawlId, pageId) {
        return this.db.query(`SELECT ${COLS}, p.url FROM page_issues i
         JOIN pages p ON p.id = i.page_id
        WHERE i.crawl_id = $1 AND i.page_id = $2
        ORDER BY CASE i.severity
                   WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3
                   WHEN 'low' THEN 4 ELSE 5 END, i.check_id`, [crawlId, pageId]);
    }
    /**
     * The OTHER pages sharing a duplicated title / description / h1 with this one.
     *
     * This is the "where" of a duplicate issue: a `duplicate.title` finding is
     * meaningless without the list of URLs it collides with. duplicate_groups has
     * held these page ids all along; nothing ever read them.
     */
    duplicateSiblings(crawlId, pageId) {
        return this.db.query(`SELECT d.field,
              d.sample,
              d.page_count AS "pageCount",
              (SELECT coalesce(array_agg(p.url ORDER BY p.url), '{}')
                 FROM pages p
                WHERE p.id = ANY(d.page_ids) AND p.id <> $2) AS urls
         FROM duplicate_groups d
        WHERE d.crawl_id = $1 AND $2 = ANY(d.page_ids)`, [crawlId, pageId]);
    }
    /** Duplicate groups across the crawl — the site-wide view of the same data. */
    listDuplicateGroups(crawlId, field) {
        const params = [crawlId];
        let where = 'd.crawl_id = $1';
        if (field) {
            params.push(field);
            where += ` AND d.field = $${params.length}`;
        }
        return this.db.query(`SELECT d.field, d.sample, d.page_count AS "pageCount",
              (SELECT coalesce(array_agg(p.url ORDER BY p.url), '{}')
                 FROM pages p WHERE p.id = ANY(d.page_ids)) AS urls
         FROM duplicate_groups d
        WHERE ${where}
        ORDER BY d.page_count DESC
        LIMIT 200`, params);
    }
    summaryByCrawl(crawlId) {
        return this.db.query(`SELECT check_id AS "checkId", severity::text, count(*)::int AS count
       FROM page_issues WHERE crawl_id = $1
       GROUP BY check_id, severity ORDER BY count DESC`, [crawlId]);
    }
    countsBySeverity(crawlId) {
        return this.db.query(`SELECT severity::text, count(*)::int AS count FROM page_issues
       WHERE crawl_id = $1 GROUP BY severity`, [crawlId]);
    }
    /**
     * Cross-page duplicate detection: groups snapshots sharing an artifact hash
     * and inserts one issue per affected page, plus a duplicate_groups row per
     * value. Runs entirely in SQL — no page data is pulled into the worker.
     */
    async insertDuplicateIssues(input) {
        const { crawlId, websiteId, hashField, sampleField, checkId, severity, duplicateField } = input;
        return this.db.transaction(async (client) => {
            await client.query(`INSERT INTO duplicate_groups (crawl_id, website_id, field, value_hash, sample, page_ids, page_count)
         SELECT $1, $2, $3, decode(md5(g.hash), 'hex'), g.sample, g.page_ids, g.cnt
         FROM (
           SELECT artifacts ->> '${hashField}' AS hash,
                  min(artifacts ->> '${sampleField}') AS sample,
                  array_agg(page_id) AS page_ids,
                  count(*)::int AS cnt
           FROM page_snapshots
           WHERE crawl_id = $1 AND artifacts ->> '${hashField}' IS NOT NULL
             AND coalesce(artifacts ->> '${sampleField}', '') <> ''
           GROUP BY artifacts ->> '${hashField}'
           HAVING count(*) > 1
         ) g`, [crawlId, websiteId, duplicateField]);
            const res = await client.query(`INSERT INTO page_issues (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
         SELECT s.crawl_id, s.id, s.page_id, s.website_id, $3, $4::issue_severity,
                sha256(($2 || ':' || s.page_id::text || ':' || $3)::bytea),
                jsonb_build_object(
                  'value', s.artifacts ->> '${sampleField}',
                  'duplicateCount', d.cnt,
                  'field', $5::text
                )
         FROM page_snapshots s
         JOIN (
           SELECT artifacts ->> '${hashField}' AS hash, count(*)::int AS cnt
           FROM page_snapshots
           WHERE crawl_id = $1 AND artifacts ->> '${hashField}' IS NOT NULL
             AND coalesce(artifacts ->> '${sampleField}', '') <> ''
           GROUP BY artifacts ->> '${hashField}'
           HAVING count(*) > 1
         ) d ON d.hash = s.artifacts ->> '${hashField}'
         WHERE s.crawl_id = $1
         RETURNING id`, [crawlId, websiteId, checkId, severity, duplicateField]);
            return res.rows.length;
        });
    }
    /**
     * Broken-link issues: for every broken target in link_checks, attach one
     * issue to each snapshot whose extracted links reference it (lateral join
     * over the links artifact).
     */
    async insertBrokenLinkIssues(input) {
        const res = await this.db.query(`INSERT INTO page_issues (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
       SELECT s.crawl_id, s.id, s.page_id, s.website_id,
              CASE WHEN lc.is_internal THEN $2 ELSE $4 END,
              (CASE WHEN lc.is_internal THEN $3 ELSE $5 END)::issue_severity,
              sha256((s.page_id::text || ':' || lc.url || ':broken')::bytea),
              jsonb_build_object('target', lc.url, 'status', lc.status, 'error', lc.error,
                                 'anchorText', l.item ->> 'text',
                                 'selector', l.item ->> 'selector',
                                 'snippet', l.item ->> 'snippet')
       FROM link_checks lc
       JOIN page_snapshots s ON s.crawl_id = lc.crawl_id
       CROSS JOIN LATERAL (
         SELECT item FROM jsonb_array_elements(coalesce(s.artifacts -> 'links', '[]'::jsonb)) AS item
         WHERE item ->> 'href' = lc.url LIMIT 1
       ) l
       WHERE lc.crawl_id = $1 AND NOT lc.ok
       RETURNING id`, [
            input.crawlId,
            input.internalCheckId,
            input.internalSeverity,
            input.externalCheckId,
            input.externalSeverity,
        ]);
        return res.length;
    }
    /**
     * Broken-image issues: same lateral-join shape as broken links, but over the
     * images artifact. The per-page engine cannot emit this check because link
     * verification happens asynchronously after the page is processed.
     */
    async insertBrokenImageIssues(input) {
        const res = await this.db.query(`INSERT INTO page_issues (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
       SELECT s.crawl_id, s.id, s.page_id, s.website_id, $2, $3::issue_severity,
              sha256((s.page_id::text || ':' || lc.url || ':broken_img')::bytea),
              jsonb_build_object('target', lc.url, 'status', lc.status, 'error', lc.error,
                                 'alt', img.item ->> 'alt',
                                 'selector', img.item ->> 'selector',
                                 'snippet', img.item ->> 'snippet')
       FROM link_checks lc
       JOIN page_snapshots s ON s.crawl_id = lc.crawl_id
       CROSS JOIN LATERAL (
         SELECT item FROM jsonb_array_elements(coalesce(s.artifacts -> 'images', '[]'::jsonb)) AS item
         WHERE item ->> 'src' = lc.url LIMIT 1
       ) img
       WHERE lc.crawl_id = $1 AND NOT lc.ok AND lc.url <> ''
       RETURNING id`, [input.crawlId, input.checkId, input.severity]);
        return res.length;
    }
    /**
     * Redirect-chain issues: link_checks records redirect_hops, but nothing ever
     * consumed it. Attach an issue to each page linking to an over-long chain.
     */
    async insertRedirectChainIssues(input) {
        const res = await this.db.query(`INSERT INTO page_issues (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
       SELECT s.crawl_id, s.id, s.page_id, s.website_id, $2, $3::issue_severity,
              sha256((s.page_id::text || ':' || lc.url || ':redirect')::bytea),
              jsonb_build_object('target', lc.url, 'hops', lc.redirect_hops,
                                 'anchorText', l.item ->> 'text',
                                 'selector', l.item ->> 'selector',
                                 'snippet', l.item ->> 'snippet')
       FROM link_checks lc
       JOIN page_snapshots s ON s.crawl_id = lc.crawl_id
       CROSS JOIN LATERAL (
         SELECT item FROM jsonb_array_elements(coalesce(s.artifacts -> 'links', '[]'::jsonb)) AS item
         WHERE item ->> 'href' = lc.url LIMIT 1
       ) l
       WHERE lc.crawl_id = $1 AND lc.redirect_hops > $4
       RETURNING id`, [input.crawlId, input.checkId, input.severity, input.maxHops]);
        return res.length;
    }
    /**
     * Recompute every snapshot's score and issue_counts from the COMPLETE issue
     * set for the crawl.
     *
     * The per-page score written during page processing only ever saw that page's
     * own rule failures — duplicate, broken-link, broken-image and redirect issues
     * are inserted here at finalize, after the fact. Without this pass those
     * deductions are silently missing from every page score, and from the site
     * average derived from them.
     *
     * Mirrors packages/seo-engine/src/scoring.ts exactly:
     *   100 − Σ_distinct_check( weight × (1 + log2(instances) × 0.1) × severityMultiplier )
     */
    async recomputeSnapshotScores(crawlId) {
        return this.db.transaction(async (client) => {
            await client.query(`WITH per_check AS (
           SELECT page_id, check_id, severity, count(*)::int AS instances
           FROM page_issues WHERE crawl_id = $1
           GROUP BY page_id, check_id, severity
         ),
         deduction AS (
           SELECT pc.page_id,
                  sum(
                    coalesce(c.default_weight, 10)
                    * (1 + log(2, pc.instances::numeric) * 0.1)
                    * m.mult
                  ) AS total
           FROM per_check pc
           LEFT JOIN checks c ON c.id = pc.check_id
           JOIN (VALUES ('critical', 1.0), ('high', 0.6), ('medium', 0.3),
                        ('low', 0.1), ('info', 0.0)) AS m(sev, mult)
             ON m.sev = pc.severity::text
           GROUP BY pc.page_id
         )
         UPDATE page_snapshots s
            SET score = greatest(0, least(100, 100 - d.total))
           FROM deduction d
          WHERE s.crawl_id = $1 AND s.page_id = d.page_id`, [crawlId]);
            const res = await client.query(`WITH counts AS (
           SELECT page_id, jsonb_object_agg(sev, cnt) AS counts
           FROM (
             SELECT page_id, severity::text AS sev, count(*)::int AS cnt
             FROM page_issues WHERE crawl_id = $1
             GROUP BY page_id, severity
           ) x
           GROUP BY page_id
         )
         UPDATE page_snapshots s
            SET issue_counts = c.counts
           FROM counts c
          WHERE s.crawl_id = $1 AND s.page_id = c.page_id
        RETURNING s.page_id`, [crawlId]);
            return res.rows.length;
        });
    }
}
exports.PageIssuesRepository = PageIssuesRepository;
//# sourceMappingURL=page-issues.repository.js.map