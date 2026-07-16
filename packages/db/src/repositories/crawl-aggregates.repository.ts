import type { Database } from '../database';

export interface CrawlAggregateRow {
  crawlId: string;
  websiteId: string;
  seoScore: string;
  metrics: Record<string, unknown>;
  createdAt: Date;
}

export class CrawlAggregatesRepository {
  constructor(private readonly db: Database) {}

  async upsert(input: {
    crawlId: string;
    websiteId: string;
    seoScore: number;
    metrics: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO crawl_aggregates (crawl_id, website_id, seo_score, metrics)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (crawl_id) DO UPDATE SET seo_score = EXCLUDED.seo_score, metrics = EXCLUDED.metrics`,
      [input.crawlId, input.websiteId, input.seoScore, JSON.stringify(input.metrics)],
    );
  }

  findByCrawl(crawlId: string): Promise<CrawlAggregateRow | null> {
    return this.db.queryOne<CrawlAggregateRow>(
      `SELECT crawl_id AS "crawlId", website_id AS "websiteId", seo_score AS "seoScore",
              metrics, created_at AS "createdAt"
       FROM crawl_aggregates WHERE crawl_id = $1`,
      [crawlId],
    );
  }

  /** trend_daily: last crawl of the day wins. */
  async upsertTrendDay(input: {
    websiteId: string;
    crawlId: string;
    seoScore: number;
    metrics: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO trend_daily (website_id, day, crawl_id, seo_score, metrics)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)
       ON CONFLICT (website_id, day)
       DO UPDATE SET crawl_id = EXCLUDED.crawl_id, seo_score = EXCLUDED.seo_score, metrics = EXCLUDED.metrics`,
      [input.websiteId, input.crawlId, input.seoScore, JSON.stringify(input.metrics)],
    );
  }

  /**
   * Per-category trend. trend_daily is keyed (website_id, day) and so can only
   * hold one score per website per day — this parallel table is what gives each
   * sitemap group its own history and card sparkline.
   */
  async upsertGroupTrendDay(input: {
    sitemapGroupId: string;
    crawlId: string;
    seoScore: number;
    metrics: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO trend_daily_group (sitemap_group_id, day, crawl_id, seo_score, metrics)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)
       ON CONFLICT (sitemap_group_id, day)
       DO UPDATE SET crawl_id = EXCLUDED.crawl_id, seo_score = EXCLUDED.seo_score, metrics = EXCLUDED.metrics`,
      [input.sitemapGroupId, input.crawlId, input.seoScore, JSON.stringify(input.metrics)],
    );
  }

  /** Site score components: mean page score + share of pages with critical issues. */
  scoreComponents(crawlId: string): Promise<{
    avgScore: string | null;
    scoredPages: number;
    criticalPages: number;
  } | null> {
    return this.db.queryOne(
      `SELECT avg(score) AS "avgScore",
              count(score)::int AS "scoredPages",
              count(*) FILTER (WHERE (issue_counts ->> 'critical')::int > 0)::int AS "criticalPages"
       FROM page_snapshots WHERE crawl_id = $1 AND score IS NOT NULL`,
      [crawlId],
    );
  }
}
