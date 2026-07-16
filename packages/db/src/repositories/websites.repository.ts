import type { Database } from '../database';

export interface WebsiteRow {
  id: string;
  projectId: string;
  name: string;
  origin: string;
  pathScope: string;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLS = `id, project_id AS "projectId", name, origin, path_scope AS "pathScope",
  settings, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`;

export class WebsitesRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): Promise<WebsiteRow | null> {
    return this.db.queryOne<WebsiteRow>(`SELECT ${COLS} FROM websites WHERE id = $1`, [id]);
  }

  listByProject(projectId: string): Promise<WebsiteRow[]> {
    return this.db.query<WebsiteRow>(
      `SELECT ${COLS} FROM websites WHERE project_id = $1 ORDER BY name`,
      [projectId],
    );
  }

  async create(input: {
    projectId: string;
    name: string;
    origin: string;
    pathScope?: string;
    settings?: Record<string, unknown>;
  }): Promise<WebsiteRow> {
    const row = await this.db.queryOne<WebsiteRow>(
      `INSERT INTO websites (project_id, name, origin, path_scope, settings)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLS}`,
      [
        input.projectId,
        input.name,
        input.origin,
        input.pathScope ?? '/',
        JSON.stringify(input.settings ?? {}),
      ],
    );
    if (!row) throw new Error('insert returned no row');
    return row;
  }

  update(
    id: string,
    patch: { name?: string; settings?: Record<string, unknown>; isActive?: boolean },
  ): Promise<WebsiteRow | null> {
    return this.db.queryOne<WebsiteRow>(
      `UPDATE websites SET
         name = COALESCE($2, name),
         settings = COALESCE($3, settings),
         is_active = COALESCE($4, is_active),
         updated_at = now()
       WHERE id = $1 RETURNING ${COLS}`,
      [
        id,
        patch.name ?? null,
        patch.settings ? JSON.stringify(patch.settings) : null,
        patch.isActive ?? null,
      ],
    );
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.query(`DELETE FROM websites WHERE id = $1 RETURNING id`, [id]);
    return rows.length > 0;
  }

  /** Resolves the owning project for RBAC checks on nested resources. */
  async projectIdOf(websiteId: string): Promise<string | null> {
    const row = await this.db.queryOne<{ projectId: string }>(
      `SELECT project_id AS "projectId" FROM websites WHERE id = $1`,
      [websiteId],
    );
    return row?.projectId ?? null;
  }
}
