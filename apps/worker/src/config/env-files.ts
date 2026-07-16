import { resolve } from 'node:path';

/**
 * Candidate .env locations, most specific first. The worker runs from its own
 * package directory while the canonical .env lives at the monorepo root, so we
 * look in both the current working directory and the repo root.
 */
export function envFilePaths(): string[] {
  return [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../../../.env'),
    resolve(__dirname, '../../../../.env'),
  ];
}
