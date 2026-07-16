"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const pg_1 = require("pg");
// Keep bigint counts as numbers (audit log ids, counts). Safe for values < 2^53.
pg_1.types.setTypeParser(pg_1.types.builtins.INT8, (v) => Number(v));
/**
 * Thin typed wrapper around pg.Pool. All repository SQL goes through this class,
 * which owns pooling and transaction semantics; nothing outside packages/db
 * should compose SQL strings.
 */
class Database {
    pool;
    constructor(options) {
        this.pool = new pg_1.Pool({
            connectionString: options.connectionString,
            max: options.max ?? 10,
            application_name: options.applicationName ?? 'seo-guardian',
        });
    }
    async query(text, params = []) {
        const result = await this.pool.query(text, params);
        return result.rows;
    }
    async queryOne(text, params = []) {
        const rows = await this.query(text, params);
        return rows[0] ?? null;
    }
    /** Runs fn inside a transaction; rolls back on any throw. */
    async transaction(fn) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    async healthCheck() {
        const row = await this.queryOne('SELECT 1 AS ok');
        return row?.ok === 1;
    }
    async close() {
        await this.pool.end();
    }
}
exports.Database = Database;
//# sourceMappingURL=database.js.map