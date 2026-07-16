"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersRepository = void 0;
const COLS = `id, email, password_hash AS "passwordHash", name,
  is_super_admin AS "isSuperAdmin", is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt"`;
class UsersRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        return this.db.queryOne(`SELECT ${COLS} FROM users WHERE id = $1`, [id]);
    }
    findByEmail(email) {
        return this.db.queryOne(`SELECT ${COLS} FROM users WHERE email = $1`, [email]);
    }
    async list(limit, cursor) {
        if (cursor) {
            return this.db.query(`SELECT ${COLS} FROM users WHERE (created_at, id) < ($1, $2)
         ORDER BY created_at DESC, id DESC LIMIT $3`, [cursor.createdAt, cursor.id, limit]);
        }
        return this.db.query(`SELECT ${COLS} FROM users ORDER BY created_at DESC, id DESC LIMIT $1`, [limit]);
    }
    async create(input) {
        const row = await this.db.queryOne(`INSERT INTO users (email, password_hash, name, is_super_admin)
       VALUES ($1, $2, $3, $4) RETURNING ${COLS}`, [input.email, input.passwordHash, input.name, input.isSuperAdmin ?? false]);
        if (!row)
            throw new Error('insert returned no row');
        return row;
    }
    async update(id, patch) {
        return this.db.queryOne(`UPDATE users SET
         name = COALESCE($2, name),
         is_active = COALESCE($3, is_active),
         is_super_admin = COALESCE($4, is_super_admin),
         password_hash = COALESCE($5, password_hash),
         updated_at = now()
       WHERE id = $1 RETURNING ${COLS}`, [
            id,
            patch.name ?? null,
            patch.isActive ?? null,
            patch.isSuperAdmin ?? null,
            patch.passwordHash ?? null,
        ]);
    }
    async countAll() {
        const row = await this.db.queryOne('SELECT count(*)::int AS count FROM users');
        return row?.count ?? 0;
    }
}
exports.UsersRepository = UsersRepository;
//# sourceMappingURL=users.repository.js.map