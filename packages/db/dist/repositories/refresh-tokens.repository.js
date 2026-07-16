"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokensRepository = void 0;
const COLS = `id, user_id AS "userId", family_id AS "familyId", token_hash AS "tokenHash",
  expires_at AS "expiresAt", revoked_at AS "revokedAt", replaced_by_id AS "replacedById",
  created_at AS "createdAt"`;
class RefreshTokensRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findByHash(tokenHash) {
        return this.db.queryOne(`SELECT ${COLS} FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
    }
    async create(input) {
        const row = await this.db.queryOne(`INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING ${COLS}`, [input.userId, input.familyId, input.tokenHash, input.expiresAt]);
        if (!row)
            throw new Error('insert returned no row');
        return row;
    }
    /** Marks a token consumed (rotated) and records its successor. */
    async markReplaced(id, replacedById) {
        await this.db.query(`UPDATE refresh_tokens SET revoked_at = now(), replaced_by_id = $2 WHERE id = $1`, [id, replacedById]);
    }
    /** Reuse detected or logout: kill every live token in the family. */
    async revokeFamily(familyId) {
        await this.db.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`, [familyId]);
    }
    async revokeAllForUser(userId) {
        await this.db.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    }
    async deleteExpired() {
        const rows = await this.db.query(`DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days' RETURNING id`);
        return rows.length;
    }
}
exports.RefreshTokensRepository = RefreshTokensRepository;
//# sourceMappingURL=refresh-tokens.repository.js.map