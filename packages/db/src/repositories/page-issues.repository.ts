import type { Database } from '../database';

export interface IssueRow {
  id: string;
  crawlId: string;
  snapshotId: string;
  pageId: string;
  websiteId: string;
  checkId: string;
  severity: string;
  fingerprint: Buffer;
  evidence: Record<string, unknown>;
  createdAt: Date;
  url?: string;
}

const COLS = `i.id, i.crawl_id AS "crawlId", i.snapshot_id AS "snapshotId", i.page_id AS "pageId",
  i.website_id AS "websiteId", i.check_id AS "checkId", i.severity, i.fingerprint, i.evidence,
  i.created_at AS "createdAt"`;

export class PageIssuesRepository {
  constructor(private readonly db: Database) {}

  listByCrawl(
    crawlId: string,
    opts: {
      limit: number;
      cursor?: { createdAt: Date; id: string };
      severity?: string[];
      checkId?: string;
    },
  ): Promise<IssueRow[]> {
    const params: unknown[] = [crawlId];
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
    return this.db.query<IssueRow>(
      `SELECT ${COLS}, p.url FROM page_issues i JOIN pages p ON p.id = i.page_id
       WHERE ${where} ORDER BY i.created_at, i.id LIMIT $${params.length}`,
      params,
    );
  }

  /** Every issue on one page, newest-severity-first. */
  listByPage(crawlId: string, pageId: string): Promise<IssueRow[]> {
    return this.db.query<IssueRow>(
      `SELECT ${COLS}, p.url FROM page_issues i
         JOIN pages p ON p.id = i.page_id
        WHERE i.crawl_id = $1 AND i.page_id = $2
        ORDER BY CASE i.severity
                   WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3
                   WHEN 'low' THEN 4 ELSE 5 END, i.check_id`,
      [crawlId, pageId],
    );
  }

  /**
   * The OTHER pages sharing a duplicated title / description / h1 with this one.
   *
   * This is the "where" of a duplicate issue: a `duplicate.title` finding is
   * meaningless without the list of URLs it collides with. duplicate_groups has
   * held these page ids all along; nothing ever read them.
   */
  duplicateSiblings(
    crawlId: string,
    pageId: string,
  ): Promise<Array<{ field: string; sample: string; pageCount: number; urls: string[] }>> {
    return this.db.query(
      `SELECT d.field,
              d.sample,
              d.page_count AS "pageCount",
              (SELECT coalesce(array_agg(p.url ORDER BY p.url), '{}')
                 FROM pages p
                WHERE p.id = ANY(d.page_ids) AND p.id <> $2) AS urls
         FROM duplicate_groups d
        WHERE d.crawl_id = $1 AND $2 = ANY(d.page_ids)`,
      [crawlId, pageId],
    );
  }

  /** Duplicate groups across the crawl — the site-wide view of the same data. */
  listDuplicateGroups(
    crawlId: string,
    field?: string,
  ): Promise<Array<{ field: string; sample: string; pageCount: number; urls: string[] }>> {
    const params: unknown[] = [crawlId];
    let where = 'd.crawl_id = $1';
    if (field) {
      params.push(field);
      where += ` AND d.field = $${params.length}`;
    }
    return this.db.query(
      `SELECT d.field, d.sample, d.page_count AS "pageCount",
              (SELECT coalesce(array_agg(p.url ORDER BY p.url), '{}')
                 FROM pages p WHERE p.id = ANY(d.page_ids)) AS urls
         FROM duplicate_groups d
        WHERE ${where}
        ORDER BY d.page_count DESC
        LIMIT 200`,
      params,
    );
  }

  summaryByCrawl(
    crawlId: string,
  ): Promise<Array<{ checkId: string; severity: string; count: number }>> {
    return this.db.query(
      `SELECT check_id AS "checkId", severity::text, count(*)::int AS count
       FROM page_issues WHERE crawl_id = $1
       GROUP BY check_id, severity ORDER BY count DESC`,
      [crawlId],
    );
  }

  countsBySeverity(crawlId: string): Promise<Array<{ severity: string; count: number }>> {
    return this.db.query(
      `SELECT severity::text, count(*)::int AS count FROM page_issues
       WHERE crawl_id = $1 GROUP BY severity`,
      [crawlId],
    );
  }

  /**
   * Cross-page duplicate detection: groups snapshots sharing an artifact hash
   * and inserts one issue per affected page, plus a duplicate_groups row per
   * value. Runs entirely in SQL — no page data is pulled into the worker.
   */
  async insertDuplicateIssues(input: {
    crawlId: string;
    websiteId: string;
    hashField: 'titleHash' | 'descriptionHash' | 'h1Hash';
    sampleField: 'title' | 'metaDescription' | 'h1Text';
    checkId: string;
    severity: string;
    duplicateField: string;
  }): Promise<number> {
    const { crawlId, websiteId, hashField, sampleField, checkId, severity, duplicateField } = input;
    return this.db.transaction(async (client) => {
      // Re-driven finalizes would otherwise append a second copy of every group
      // and issue for this field. See clearChecks().
      await client.query(`DELETE FROM duplicate_groups WHERE crawl_id = $1 AND field = $2`, [
        crawlId,
        duplicateField,
      ]);
      await client.query(`DELETE FROM page_issues WHERE crawl_id = $1 AND check_id = $2`, [
        crawlId,
        checkId,
      ]);
      await client.query(
        `INSERT INTO duplicate_groups (crawl_id, website_id, field, value_hash, sample, page_ids, page_count)
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
         ) g`,
        [crawlId, websiteId, duplicateField],
      );
      const res = await client.query<{ id: string }>(
        `INSERT INTO page_issues (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
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
         RETURNING id`,
        [crawlId, websiteId, checkId, severity, duplicateField],
      );
      return res.rows.length;
    });
  }

  /**
   * Broken-link issues: for every broken target in link_checks, attach one
   * issue to each snapshot whose extracted links reference it.
   *
   * Driven from page_snapshots, expanding each snapshot's links artifact exactly
   * once and hash-joining the result to link_checks on the href. Driving it the
   * other way — link_checks JOIN page_snapshots ON crawl_id, with a lateral
   * membership test over the artifact — is a cartesian product that re-parses
   * (and detoasts) every snapshot's artifacts once per broken link: 5k broken
   * links x 2.4k snapshots = 12M jsonb expansions, which took finalize from
   * sub-second to hours and left the crawl frozen in 'finalizing'.
   */
  async insertBrokenLinkIssues(input: {
    crawlId: string;
    internalCheckId: string;
    internalSeverity: string;
    externalCheckId: string;
    externalSeverity: string;
  }): Promise<number> {
    await this.clearChecks(input.crawlId, [input.internalCheckId, input.externalCheckId]);
    const res = await this.db.query<{ id: string }>(
      `INSERT INTO page_issues (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
       SELECT s.crawl_id, s.id, s.page_id, s.website_id,
              CASE WHEN lc.is_internal THEN $2 ELSE $4 END,
              (CASE WHEN lc.is_internal THEN $3 ELSE $5 END)::issue_severity,
              sha256((s.page_id::text || ':' || lc.url || ':broken')::bytea),
              jsonb_build_object('target', lc.url, 'status', lc.status, 'error', lc.error,
                                 'anchorText', l.item ->> 'text',
                                 'selector', l.item ->> 'selector',
                                 'snippet', l.item ->> 'snippet')
       FROM page_snapshots s
       CROSS JOIN LATERAL (
         SELECT DISTINCT ON (item ->> 'href') item
         FROM jsonb_array_elements(coalesce(s.artifacts -> 'links', '[]'::jsonb))
           WITH ORDINALITY AS a(item, ord)
         WHERE item ->> 'href' IS NOT NULL
         ORDER BY item ->> 'href', a.ord
       ) l
       JOIN link_checks lc
         ON lc.crawl_id = s.crawl_id AND lc.url = l.item ->> 'href' AND NOT lc.ok
       WHERE s.crawl_id = $1
       RETURNING id`,
      [
        input.crawlId,
        input.internalCheckId,
        input.internalSeverity,
        input.externalCheckId,
        input.externalSeverity,
      ],
    );
    return res.length;
  }

  /**
   * Broken-image issues: same lateral-join shape as broken links, but over the
   * images artifact. The per-page engine cannot emit this check because link
   * verification happens asynchronously after the page is processed.
   */
  async insertBrokenImageIssues(input: {
    crawlId: string;
    checkId: string;
    severity: string;
  }): Promise<number> {
    await this.clearChecks(input.crawlId, [input.checkId]);
    const res = await this.db.query<{ id: string }>(
      `INSERT INTO page_issues (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
       SELECT s.crawl_id, s.id, s.page_id, s.website_id, $2, $3::issue_severity,
              sha256((s.page_id::text || ':' || lc.url || ':broken_img')::bytea),
              jsonb_build_object('target', lc.url, 'status', lc.status, 'error', lc.error,
                                 'alt', img.item ->> 'alt',
                                 'selector', img.item ->> 'selector',
                                 'snippet', img.item ->> 'snippet')
       FROM page_snapshots s
       CROSS JOIN LATERAL (
         SELECT DISTINCT ON (item ->> 'src') item
         FROM jsonb_array_elements(coalesce(s.artifacts -> 'images', '[]'::jsonb))
           WITH ORDINALITY AS a(item, ord)
         WHERE coalesce(item ->> 'src', '') <> ''
         ORDER BY item ->> 'src', a.ord
       ) img
       JOIN link_checks lc
         ON lc.crawl_id = s.crawl_id AND lc.url = img.item ->> 'src' AND NOT lc.ok
       WHERE s.crawl_id = $1
       RETURNING id`,
      [input.crawlId, input.checkId, input.severity],
    );
    return res.length;
  }

  /**
   * Redirect-chain issues: link_checks records redirect_hops, but nothing ever
   * consumed it. Attach an issue to each page linking to an over-long chain.
   */
  async insertRedirectChainIssues(input: {
    crawlId: string;
    checkId: string;
    severity: string;
    maxHops: number;
  }): Promise<number> {
    await this.clearChecks(input.crawlId, [input.checkId]);
    const res = await this.db.query<{ id: string }>(
      `INSERT INTO page_issues (crawl_id, snapshot_id, page_id, website_id, check_id, severity, fingerprint, evidence)
       SELECT s.crawl_id, s.id, s.page_id, s.website_id, $2, $3::issue_severity,
              sha256((s.page_id::text || ':' || lc.url || ':redirect')::bytea),
              jsonb_build_object('target', lc.url, 'hops', lc.redirect_hops,
                                 'anchorText', l.item ->> 'text',
                                 'selector', l.item ->> 'selector',
                                 'snippet', l.item ->> 'snippet')
       FROM page_snapshots s
       CROSS JOIN LATERAL (
         SELECT DISTINCT ON (item ->> 'href') item
         FROM jsonb_array_elements(coalesce(s.artifacts -> 'links', '[]'::jsonb))
           WITH ORDINALITY AS a(item, ord)
         WHERE item ->> 'href' IS NOT NULL
         ORDER BY item ->> 'href', a.ord
       ) l
       JOIN link_checks lc
         ON lc.crawl_id = s.crawl_id AND lc.url = l.item ->> 'href'
        AND lc.redirect_hops > $4
       WHERE s.crawl_id = $1
       RETURNING id`,
      [input.crawlId, input.checkId, input.severity, input.maxHops],
    );
    return res.length;
  }

  /**
   * Drop issues a finalize pass owns before re-inserting them. Finalize is
   * re-driven by the watchdog whenever it stalls, and without this the derived
   * issues are appended again on every attempt — one interrupted run had already
   * doubled links.internal.broken to 16k rows over 8k distinct fingerprints.
   */
  private async clearChecks(crawlId: string, checkIds: string[]): Promise<void> {
    await this.db.query(`DELETE FROM page_issues WHERE crawl_id = $1 AND check_id = ANY($2)`, [
      crawlId,
      checkIds,
    ]);
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
  async recomputeSnapshotScores(crawlId: string): Promise<number> {
    return this.db.transaction(async (client) => {
      await client.query(
        `WITH per_check AS (
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
          WHERE s.crawl_id = $1 AND s.page_id = d.page_id`,
        [crawlId],
      );
      const res = await client.query<{ page_id: string }>(
        `WITH counts AS (
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
        RETURNING s.page_id`,
        [crawlId],
      );
      return res.rows.length;
    });
  }
}
