import type { Database } from '../database';

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLS = `id, email, password_hash AS "passwordHash", name,
  is_super_admin AS "isSuperAdmin", is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export class UsersRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): Promise<UserRow | null> {
    return this.db.queryOne<UserRow>(`SELECT ${COLS} FROM users WHERE id = $1`, [id]);
  }

  findByEmail(email: string): Promise<UserRow | null> {
    return this.db.queryOne<UserRow>(`SELECT ${COLS} FROM users WHERE email = $1`, [email]);
  }

  async list(limit: number, cursor?: { createdAt: Date; id: string }): Promise<UserRow[]> {
    if (cursor) {
      return this.db.query<UserRow>(
        `SELECT ${COLS} FROM users WHERE (created_at, id) < ($1, $2)
         ORDER BY created_at DESC, id DESC LIMIT $3`,
        [cursor.createdAt, cursor.id, limit],
      );
    }
    return this.db.query<UserRow>(
      `SELECT ${COLS} FROM users ORDER BY created_at DESC, id DESC LIMIT $1`,
      [limit],
    );
  }

  async create(input: {
    email: string;
    passwordHash: string;
    name: string;
    isSuperAdmin?: boolean;
  }): Promise<UserRow> {
    const row = await this.db.queryOne<UserRow>(
      `INSERT INTO users (email, password_hash, name, is_super_admin)
       VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
      [input.email, input.passwordHash, input.name, input.isSuperAdmin ?? false],
    );
    if (!row) throw new Error('insert returned no row');
    return row;
  }

  async update(
    id: string,
    patch: Partial<Pick<UserRow, 'name' | 'isActive' | 'isSuperAdmin' | 'passwordHash'>>,
  ): Promise<UserRow | null> {
    return this.db.queryOne<UserRow>(
      `UPDATE users SET
         name = COALESCE($2, name),
         is_active = COALESCE($3, is_active),
         is_super_admin = COALESCE($4, is_super_admin),
         password_hash = COALESCE($5, password_hash),
         updated_at = now()
       WHERE id = $1 RETURNING ${COLS}`,
      [
        id,
        patch.name ?? null,
        patch.isActive ?? null,
        patch.isSuperAdmin ?? null,
        patch.passwordHash ?? null,
      ],
    );
  }

  async countAll(): Promise<number> {
    const row = await this.db.queryOne<{ count: number }>(
      'SELECT count(*)::int AS count FROM users',
    );
    return row?.count ?? 0;
  }
}
