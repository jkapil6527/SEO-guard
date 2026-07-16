"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlAggregatesRepository = void 0;
class CrawlAggregatesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async upsert(input) {
        await this.db.query(`INSERT INTO crawl_aggregates (crawl_id, website_id, seo_score, metrics)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (crawl_id) DO UPDATE SET seo_score = EXCLUDED.seo_score, metrics = EXCLUDED.metrics`, [input.crawlId, input.websiteId, input.seoScore, JSON.stringify(input.metrics)]);
    }
    findByCrawl(crawlId) {
        return this.db.queryOne(`SELECT crawl_id AS "crawlId", website_id AS "websiteId", seo_score AS "seoScore",
              metrics, created_at AS "createdAt"
       FROM crawl_aggregates WHERE crawl_id = $1`, [crawlId]);
    }
    /** trend_daily: last crawl of the day wins. */
    async upsertTrendDay(input) {
        await this.db.query(`INSERT INTO trend_daily (website_id, day, crawl_id, seo_score, metrics)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)
       ON CONFLICT (website_id, day)
       DO UPDATE SET crawl_id = EXCLUDED.crawl_id, seo_score = EXCLUDED.seo_score, metrics = EXCLUDED.metrics`, [input.websiteId, input.crawlId, input.seoScore, JSON.stringify(input.metrics)]);
    }
    /**
     * Per-category trend. trend_daily is keyed (website_id, day) and so can only
     * hold one score per website per day — this parallel table is what gives each
     * sitemap group its own history and card sparkline.
     */
    async upsertGroupTrendDay(input) {
        await this.db.query(`INSERT INTO trend_daily_group (sitemap_group_id, day, crawl_id, seo_score, metrics)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)
       ON CONFLICT (sitemap_group_id, day)
       DO UPDATE SET crawl_id = EXCLUDED.crawl_id, seo_score = EXCLUDED.seo_score, metrics = EXCLUDED.metrics`, [input.sitemapGroupId, input.crawlId, input.seoScore, JSON.stringify(input.metrics)]);
    }
    /** Site score components: mean page score + share of pages with critical issues. */
    scoreComponents(crawlId) {
        return this.db.queryOne(`SELECT avg(score) AS "avgScore",
              count(score)::int AS "scoredPages",
              count(*) FILTER (WHERE (issue_counts ->> 'critical')::int > 0)::int AS "criticalPages"
       FROM page_snapshots WHERE crawl_id = $1 AND score IS NOT NULL`, [crawlId]);
    }
}
exports.CrawlAggregatesRepository = CrawlAggregatesRepository;
//# sourceMappingURL=crawl-aggregates.repository.js.map