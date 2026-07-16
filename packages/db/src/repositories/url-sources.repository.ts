import type { Database } from '../database';

export type UrlSourceConfig =
  | { kind: 'manual'; urls: string[] }
  | {
      kind: 'csv';
      objectKey: string;
      originalFilename: string;
      urlColumn: string;
      rowCount: number;
    }
  | { kind: 'sitemap'; sitemapUrl: string }
  | { kind: 'discovery'; seeds: string[]; maxDepth: number; maxPages: number };

export interface UrlSourceRow {
  id: string;
  websiteId: string;
  type: string;
  config: UrlSourceConfig;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
}

const COLS = `id, website_id AS "websiteId", type, config, is_active AS "isActive",
  created_by AS "createdBy", created_at AS "createdAt"`;

export class UrlSourcesRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): Promise<UrlSourceRow | null> {
    return this.db.queryOne<UrlSourceRow>(`SELECT ${COLS} FROM url_sources WHERE id = $1`, [id]);
  }

  listByWebsite(websiteId: string): Promise<UrlSourceRow[]> {
    return this.db.query<UrlSourceRow>(
      `SELECT ${COLS} FROM url_sources WHERE website_id = $1 ORDER BY created_at DESC`,
      [websiteId],
    );
  }

  async create(input: {
    websiteId: string;
    type: string;
    config: UrlSourceConfig;
    createdBy: string;
  }): Promise<UrlSourceRow> {
    const row = await this.db.queryOne<UrlSourceRow>(
      `INSERT INTO url_sources (website_id, type, config, created_by)
       VALUES ($1, $2::url_source_type, $3, $4) RETURNING ${COLS}`,
      [input.websiteId, input.type, JSON.stringify(input.config), input.createdBy],
    );
    if (!row) throw new Error('insert returned no row');
    return row;
  }

  setActive(id: string, isActive: boolean): Promise<UrlSourceRow | null> {
    return this.db.queryOne<UrlSourceRow>(
      `UPDATE url_sources SET is_active = $2 WHERE id = $1 RETURNING ${COLS}`,
      [id, isActive],
    );
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.query(`DELETE FROM url_sources WHERE id = $1 RETURNING id`, [id]);
    return rows.length > 0;
  }

  async websiteIdOf(sourceId: string): Promise<string | null> {
    const row = await this.db.queryOne<{ websiteId: string }>(
      `SELECT website_id AS "websiteId" FROM url_sources WHERE id = $1`,
      [sourceId],
    );
    return row?.websiteId ?? null;
  }
}
