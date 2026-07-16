import type { Database } from '../database';

export interface CrawlChangeInput {
  pageId: string | null;
  changeType: string;
  severity: string;
  before: unknown;
  after: unknown;
}

export interface CrawlChangeRow {
  id: string;
  crawlId: string;
  websiteId: string;
  pageId: string | null;
  changeType: string;
  severity: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
  url?: string;
}

const COLS = `c.id, c.crawl_id AS "crawlId", c.website_id AS "websiteId", c.page_id AS "pageId",
  c.change_type AS "changeType", c.severity, c.before, c.after, c.created_at AS "createdAt"`;

export class CrawlChangesRepository {
  constructor(private readonly db: Database) {}

  async insertMany(
    crawlId: string,
    websiteId: string,
    changes: CrawlChangeInput[],
  ): Promise<number> {
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < changes.length; i += CHUNK) {
      const chunk = changes.slice(i, i + CHUNK);
      const params: unknown[] = [crawlId, websiteId];
      const values = chunk
        .map((c) => {
          params.push(
            c.pageId,
            c.changeType,
            c.severity,
            c.before === undefined ? null : JSON.stringify(c.before),
            c.after === undefined ? null : JSON.stringify(c.after),
          );
          const n = params.length;
          return `($1,$2,$${n - 4},$${n - 3},$${n - 2}::issue_severity,$${n - 1},$${n})`;
        })
        .join(', ');
      await this.db.query(
        `INSERT INTO crawl_changes (crawl_id, website_id, page_id, change_type, severity, before, after)
         VALUES ${values}`,
        params,
      );
      inserted += chunk.length;
    }
    return inserted;
  }

  listByCrawl(
    crawlId: string,
    opts: {
      limit: number;
      cursor?: { createdAt: Date; id: string };
      changeType?: string;
      severity?: string[];
      changeTypes?: string[];
    },
  ): Promise<CrawlChangeRow[]> {
    const params: unknown[] = [crawlId];
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
    return this.db.query<CrawlChangeRow>(
      `SELECT ${COLS}, p.url FROM crawl_changes c LEFT JOIN pages p ON p.id = c.page_id
       WHERE ${where} ORDER BY c.created_at, c.id LIMIT $${params.length}`,
      params,
    );
  }

  summary(crawlId: string): Promise<Array<{ changeType: string; count: number }>> {
    return this.db.query(
      `SELECT change_type AS "changeType", count(*)::int AS count
       FROM crawl_changes WHERE crawl_id = $1 GROUP BY change_type ORDER BY count DESC`,
      [crawlId],
    );
  }
}
