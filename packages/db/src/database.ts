import { Pool, types } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';

// Keep bigint counts as numbers (audit log ids, counts). Safe for values < 2^53.
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

export interface DatabaseOptions {
  connectionString: string;
  max?: number;
  applicationName?: string;
}

/**
 * Thin typed wrapper around pg.Pool. All repository SQL goes through this class,
 * which owns pooling and transaction semantics; nothing outside packages/db
 * should compose SQL strings.
 */
export class Database {
  readonly pool: Pool;

  constructor(options: DatabaseOptions) {
    this.pool = new Pool({
      connectionString: options.connectionString,
      max: options.max ?? 10,
      application_name: options.applicationName ?? 'seo-guardian',
    });
  }

  async query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async queryOne<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  /** Runs fn inside a transaction; rolls back on any throw. */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    const row = await this.queryOne<{ ok: number }>('SELECT 1 AS ok');
    return row?.ok === 1;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** Executor abstraction so repository methods run on the pool or inside a transaction. */
export type Executor = Pick<Pool, 'query'> | PoolClient;
