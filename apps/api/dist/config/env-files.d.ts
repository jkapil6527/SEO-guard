/**
 * Candidate .env locations, most specific first. Apps run from their own package
 * directory (e.g. via `pnpm --filter … dev` or turbo), while the canonical .env
 * lives at the monorepo root — so we look in both the current working directory
 * and the repo root (three levels up from the compiled apps/api/dist).
 */
export declare function envFilePaths(): string[];
