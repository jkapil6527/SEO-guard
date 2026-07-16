import type { Database } from '../database';

export interface PageRef {
  id: string;
  url: string;
}

export class PagesRepository {
  constructor(private readonly db: Database) {}

  /**
   * Bulk upsert of normalized URLs; returns id+url for every input. Uses a
   * single VALUES list per chunk — the orchestrator calls this with thousands
   * of URLs, so no row-at-a-time round trips.
   */
  async upsertMany(
    websiteId: string,
    entries: Array<{ url: string; urlHash: Buffer }>,
  ): Promise<PageRef[]> {
    const out: PageRef[] = [];
    const CHUNK = 1_000;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      const params: unknown[] = [websiteId];
      const values = chunk
        .map((e) => {
          params.push(e.url, e.urlHash);
          return `($1, $${params.length - 1}, $${params.length})`;
        })
        .join(', ');
      const rows = await this.db.query<PageRef>(
        `INSERT INTO pages (website_id, url, url_hash)
         VALUES ${values}
         ON CONFLICT (website_id, url_hash)
         DO UPDATE SET last_seen_at = now(), is_deleted = false
         RETURNING id, url`,
        params,
      );
      out.push(...rows);
    }
    return out;
  }

  async upsertOne(websiteId: string, url: string, urlHash: Buffer): Promise<PageRef> {
    const rows = await this.upsertMany(websiteId, [{ url, urlHash }]);
    const row = rows[0];
    if (!row) throw new Error('upsert returned no row');
    return row;
  }
}
