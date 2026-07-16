import { Pool } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
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
export declare class Database {
    readonly pool: Pool;
    constructor(options: DatabaseOptions);
    query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
    queryOne<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<T | null>;
    /** Runs fn inside a transaction; rolls back on any throw. */
    transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
    healthCheck(): Promise<boolean>;
    close(): Promise<void>;
}
/** Executor abstraction so repository methods run on the pool or inside a transaction. */
export type Executor = Pick<Pool, 'query'> | PoolClient;
