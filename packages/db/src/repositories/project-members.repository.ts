import type { Database } from '../database';

export interface MemberRow {
  projectId: string;
  userId: string;
  role: string;
  createdAt: Date;
  email?: string;
  name?: string;
}

export class ProjectMembersRepository {
  constructor(private readonly db: Database) {}

  findRole(projectId: string, userId: string): Promise<{ role: string } | null> {
    return this.db.queryOne<{ role: string }>(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId],
    );
  }

  list(projectId: string): Promise<MemberRow[]> {
    return this.db.query<MemberRow>(
      `SELECT m.project_id AS "projectId", m.user_id AS "userId", m.role,
              m.created_at AS "createdAt", u.email, u.name
       FROM project_members m JOIN users u ON u.id = m.user_id
       WHERE m.project_id = $1 ORDER BY u.name`,
      [projectId],
    );
  }

  listForUser(userId: string): Promise<Array<{ projectId: string; role: string }>> {
    return this.db.query<{ projectId: string; role: string }>(
      `SELECT project_id AS "projectId", role FROM project_members WHERE user_id = $1`,
      [userId],
    );
  }

  async upsert(projectId: string, userId: string, role: string): Promise<MemberRow> {
    const row = await this.db.queryOne<MemberRow>(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3::project_role)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING project_id AS "projectId", user_id AS "userId", role, created_at AS "createdAt"`,
      [projectId, userId, role],
    );
    if (!row) throw new Error('upsert returned no row');
    return row;
  }

  async remove(projectId: string, userId: string): Promise<boolean> {
    const rows = await this.db.query(
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING user_id`,
      [projectId, userId],
    );
    return rows.length > 0;
  }

  async countAdmins(projectId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM project_members WHERE project_id = $1 AND role = 'admin'`,
      [projectId],
    );
    return row?.count ?? 0;
  }
}
