/* eslint-disable no-console */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

interface EmbeddedPostgresInstance {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  createDatabase(name: string): Promise<void>;
}

type EmbeddedPostgresCtor = new (options: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
}) => EmbeddedPostgresInstance;

/**
 * Provides a migrated PostgreSQL for integration tests.
 * - CI / docker: set TEST_DATABASE_URL and it is used as-is.
 * - Local without docker: boots an embedded PostgreSQL (real binaries, no daemon).
 */
export default async function globalSetup(): Promise<void> {
  let databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    // embedded-postgres is ESM-only; keep the dynamic import out of TS's CJS downleveling.
    const importEsm = new Function('specifier', 'return import(specifier)') as (
      s: string,
    ) => Promise<{ default: EmbeddedPostgresCtor }>;
    const { default: EmbeddedPostgres } = await importEsm('embedded-postgres');
    const dataDir = path.join(__dirname, '..', '.embedded-postgres', 'data');
    const pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: 'postgres',
      password: 'postgres',
      port: 54329,
      persistent: false,
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('seo_guardian_test');
    (globalThis as Record<string, unknown>).__EMBEDDED_PG__ = pg;
    databaseUrl = 'postgres://postgres:postgres@localhost:54329/seo_guardian_test';
    console.log('\nembedded-postgres started for integration tests');
  }

  const repoRoot = path.join(__dirname, '..', '..', '..');
  execFileSync('pnpm', ['--filter', '@seo-guardian/db', 'migrate:up'], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  process.env.INT_TEST_DATABASE_URL = databaseUrl;

  // Redis is provided externally (CI service container via TEST_REDIS_URL, or a
  // local redis). The crawl-pipeline suite self-skips when none is reachable;
  // the platform suite never needs Redis.
  if (process.env.TEST_REDIS_URL) {
    process.env.INT_TEST_REDIS_URL = process.env.TEST_REDIS_URL;
  }
}
