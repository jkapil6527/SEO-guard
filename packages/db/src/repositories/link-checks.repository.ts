import type { Database } from '../database';

export interface LinkCheckInput {
  url: string;
  urlHash: Buffer;
  status: number | null;
  ok: boolean;
  isInternal: boolean;
  redirectHops: number;
  error: string | null;
}

export class LinkChecksRepository {
  constructor(private readonly db: Database) {}

  async insertMany(crawlId: string, websiteId: string, checks: LinkCheckInput[]): Promise<void> {
    if (checks.length === 0) return;
    const params: unknown[] = [crawlId, websiteId];
    const values = checks
      .map((c) => {
        params.push(c.url, c.urlHash, c.status, c.ok, c.isInternal, c.redirectHops, c.error);
        const n = params.length;
        return `($1,$2,$${n - 6},$${n - 5},$${n - 4},$${n - 3},$${n - 2},$${n - 1},$${n})`;
      })
      .join(', ');
    await this.db.query(
      `INSERT INTO link_checks (crawl_id, website_id, url, url_hash, status, ok, is_internal, redirect_hops, error)
       VALUES ${values}
       ON CONFLICT (crawl_id, url_hash) DO NOTHING`,
      params,
    );
  }

  countBroken(crawlId: string): Promise<{ count: number } | null> {
    return this.db.queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM link_checks WHERE crawl_id = $1 AND NOT ok`,
      [crawlId],
    );
  }
}
