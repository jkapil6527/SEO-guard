import type { Database } from '../database';

export interface SitemapGroupRow {
  id: string;
  websiteId: string;
  name: string;
  slug: string;
  sitemapUrl: string | null;
  urlSourceId: string | null;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** A group plus everything the project-dashboard card needs, in one row. */
export interface SitemapGroupSummaryRow extends SitemapGroupRow {
  websiteName: string;
  websiteOrigin: string;
  projectId: string;
  totalUrls: number;
  lastCrawlId: string | null;
  lastCrawlStatus: string | null;
  lastCrawlAt: Date | null;
  lastFinishedAt: Date | null;
  healthScore: string | null;
  brokenUrls: number;
  errors: number;
  warnings: number;
  stats: Record<string, number> | null;
}

const COLS = `g.id, g.website_id AS "websiteId", g.name, g.slug, g.sitemap_url AS "sitemapUrl",
  g.url_source_id AS "urlSourceId", g.is_active AS "isActive", g.settings,
  g.created_at AS "createdAt", g.updated_at AS "updatedAt"`;

export class SitemapGroupsRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): Promise<SitemapGroupRow | null> {
    return this.db.queryOne<SitemapGroupRow>(
      `SELECT ${COLS} FROM sitemap_groups g WHERE g.id = $1`,
      [id],
    );
  }

  listByWebsite(websiteId: string): Promise<SitemapGroupRow[]> {
    return this.db.query<SitemapGroupRow>(
      `SELECT ${COLS} FROM sitemap_groups g WHERE g.website_id = $1 ORDER BY g.name`,
      [websiteId],
    );
  }

  /**
   * Every group in a project with its latest crawl rolled up — the whole project
   * dashboard in one query. Doing this client-side would be an N+1 across
   * groups, crawls and aggregates.
   *
   * `errors` and `warnings` map the five severities onto the two buckets the
   * card shows: critical+high are errors, medium+low+info are warnings.
   */
  listSummariesByProject(projectId: string): Promise<SitemapGroupSummaryRow[]> {
    return this.db.query<SitemapGroupSummaryRow>(
      `SELECT ${COLS},
              w.name AS "websiteName", w.origin AS "websiteOrigin", w.project_id AS "projectId",
              coalesce(u.total, 0)::int AS "totalUrls",
              c.id AS "lastCrawlId",
              c.status AS "lastCrawlStatus",
              c.created_at AS "lastCrawlAt",
              c.finished_at AS "lastFinishedAt",
              c.stats,
              a.seo_score AS "healthScore",
              coalesce((a.metrics ->> 'brokenLinks')::int, 0) AS "brokenUrls",
              coalesce((a.metrics -> 'issuesBySeverity' ->> 'critical')::int, 0)
                + coalesce((a.metrics -> 'issuesBySeverity' ->> 'high')::int, 0) AS errors,
              coalesce((a.metrics -> 'issuesBySeverity' ->> 'medium')::int, 0)
                + coalesce((a.metrics -> 'issuesBySeverity' ->> 'low')::int, 0)
                + coalesce((a.metrics -> 'issuesBySeverity' ->> 'info')::int, 0) AS warnings
         FROM sitemap_groups g
         JOIN websites w ON w.id = g.website_id
         LEFT JOIN LATERAL (
           SELECT count(*)::int AS total
             FROM page_sitemap_groups psg
            WHERE psg.sitemap_group_id = g.id
         ) u ON true
         LEFT JOIN LATERAL (
           SELECT cr.id, cr.status, cr.created_at, cr.finished_at, cr.stats
             FROM crawls cr
            WHERE cr.sitemap_group_id = g.id
            ORDER BY cr.created_at DESC
            LIMIT 1
         ) c ON true
         LEFT JOIN crawl_aggregates a ON a.crawl_id = c.id
        WHERE w.project_id = $1 AND g.is_active
        ORDER BY w.name, g.name`,
      [projectId],
    );
  }

  /** 30-day score history for a group's card sparkline. */
  trend(groupId: string, days = 30): Promise<Array<{ day: Date; seoScore: string }>> {
    return this.db.query(
      `SELECT day, seo_score AS "seoScore" FROM trend_daily_group
        WHERE sitemap_group_id = $1 AND day >= current_date - $2::int
        ORDER BY day`,
      [groupId, days],
    );
  }

  async create(input: {
    websiteId: string;
    name: string;
    slug: string;
    sitemapUrl: string | null;
    urlSourceId?: string | null;
    createdBy: string | null;
  }): Promise<SitemapGroupRow> {
    const row = await this.db.queryOne<SitemapGroupRow>(
      `INSERT INTO sitemap_groups (website_id, name, slug, sitemap_url, url_source_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, website_id AS "websiteId", name, slug, sitemap_url AS "sitemapUrl",
                 url_source_id AS "urlSourceId", is_active AS "isActive", settings,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        input.websiteId,
        input.name,
        input.slug,
        input.sitemapUrl,
        input.urlSourceId ?? null,
        input.createdBy,
      ],
    );
    if (!row) throw new Error('insert returned no row');
    return row;
  }

  async update(
    id: string,
    patch: { name?: string; sitemapUrl?: string | null; isActive?: boolean },
  ): Promise<SitemapGroupRow | null> {
    return this.db.queryOne<SitemapGroupRow>(
      `UPDATE sitemap_groups SET
         name = coalesce($2, name),
         sitemap_url = coalesce($3, sitemap_url),
         is_active = coalesce($4, is_active),
         updated_at = now()
       WHERE id = $1
       RETURNING id, website_id AS "websiteId", name, slug, sitemap_url AS "sitemapUrl",
                 url_source_id AS "urlSourceId", is_active AS "isActive", settings,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, patch.name ?? null, patch.sitemapUrl ?? null, patch.isActive ?? null],
    );
  }

  /**
   * True while a crawl of this category is still in flight. Deleting the group
   * out from under a running crawl would leave workers writing pages, issues and
   * progress for a crawl row that no longer exists.
   */
  async hasActiveCrawl(id: string): Promise<boolean> {
    const row = await this.db.queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM crawls WHERE sitemap_group_id = $1 AND status = ANY($2)
       ) AS exists`,
      [id, ['queued', 'resolving', 'running', 'paused', 'finalizing']],
    );
    return row?.exists ?? false;
  }

  /**
   * Delete a category together with the crawls that belong to it.
   *
   * crawls.sitemap_group_id is ON DELETE SET NULL, so dropping the group alone
   * would silently convert its crawls into unlabelled site-wide ones that still
   * surface in Reports. Nothing has a foreign key to crawls either, so their
   * per-crawl rows have to be cleared explicitly or they are orphaned forever.
   *
   * `pages` is deliberately untouched: a page belongs to the website and can be
   * shared with other categories. page_sitemap_groups (the membership) already
   * cascades from sitemap_groups.
   */
  async remove(id: string): Promise<void> {
    await this.db.transaction(async (client) => {
      const crawls = await client.query<{ id: string }>(
        `SELECT id FROM crawls WHERE sitemap_group_id = $1`,
        [id],
      );
      const crawlIds = crawls.rows.map((c) => c.id);
      if (crawlIds.length > 0) {
        // Partitioned tables (page_issues, page_snapshots, schema_entities,
        // crawl_changes) route through their parent.
        for (const table of [
          'crawl_aggregates',
          'crawl_changes',
          'duplicate_groups',
          'link_checks',
          'notifications_log',
          'page_issues',
          'page_snapshots',
          'schema_entities',
          'trend_daily',
          'trend_daily_group',
        ]) {
          await client.query(`DELETE FROM ${table} WHERE crawl_id = ANY($1::uuid[])`, [crawlIds]);
        }
        await client.query(`DELETE FROM crawls WHERE id = ANY($1::uuid[])`, [crawlIds]);
      }
      await client.query(`DELETE FROM sitemap_groups WHERE id = $1`, [id]);
    });
  }

  /** Record which pages belong to this group, with the sitemap's lastmod. */
  async linkPages(
    groupId: string,
    pages: Array<{ pageId: string; lastmod: Date | null }>,
  ): Promise<void> {
    if (pages.length === 0) return;
    const CHUNK = 1000;
    for (let i = 0; i < pages.length; i += CHUNK) {
      const slice = pages.slice(i, i + CHUNK);
      const values: string[] = [];
      const params: unknown[] = [groupId];
      slice.forEach((p) => {
        params.push(p.pageId, p.lastmod);
        values.push(`($1, $${params.length - 1}, $${params.length})`);
      });
      await this.db.query(
        `INSERT INTO page_sitemap_groups (sitemap_group_id, page_id, lastmod)
         VALUES ${values.join(', ')}
         ON CONFLICT (page_id, sitemap_group_id)
         DO UPDATE SET lastmod = EXCLUDED.lastmod`,
        params,
      );
    }
  }
}
