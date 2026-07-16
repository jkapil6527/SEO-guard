/**
 * Candidate .env locations, most specific first. The worker runs from its own
 * package directory while the canonical .env lives at the monorepo root, so we
 * look in both the current working directory and the repo root.
 */
export declare function envFilePaths(): string[];
