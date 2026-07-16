import type { SchemaOptions, SchemaPageContext, SchemaPageResult } from './types';
/**
 * Top-level entry point: extract → validate → evaluate rich results → run
 * page-level checks → compute coverage and per-entity summaries. Deterministic
 * and zero-I/O; safe on untrusted markup.
 */
export declare function validatePageSchema(html: string, _ctx: SchemaPageContext, options?: SchemaOptions): SchemaPageResult;
