/**
 * Aggregated single-page Technical-SEO check catalog. Ids are globally unique
 * `category.subject.condition` strings; the catalog seeds the checks table.
 */
import type { CheckDefinition } from './types';
export declare const CHECKS: readonly CheckDefinition[];
/** Looks up a check definition by id, or undefined when unknown. */
export declare function getCheck(id: string): CheckDefinition | undefined;
