/**
 * Single source of truth for every check id and its catalog metadata.
 *
 * Three kinds of check live here:
 *  - per-page checks (evaluated by the engine, see CHECKS),
 *  - cross-page checks (computed by the finalizer over set-based SQL),
 *  - runtime checks (emitted by the crawler for fetch/transport failures).
 *
 * The worker's emit points reference CHECK_IDS constants (never string
 * literals), the finalizer reads severities via getCatalogCheck, and the
 * catalog seeder persists CATALOG_CHECKS — so ids can never drift between the
 * code that writes issues and the catalog that describes them.
 */
import { IssueSeverity } from '@seo-guardian/shared';
import type { CheckCategory } from './types';
/** Stable ids for checks emitted outside the per-page engine. */
export declare const CHECK_IDS: {
    readonly FETCH_FAILED: "technical.fetch.failed";
    readonly STATUS_ERROR: "technical.status.error";
    readonly DUPLICATE_TITLE: "duplicate.title";
    readonly DUPLICATE_DESCRIPTION: "duplicate.description";
    readonly DUPLICATE_H1: "duplicate.h1";
    readonly LINK_INTERNAL_BROKEN: "links.internal.broken";
    readonly LINK_EXTERNAL_BROKEN: "links.external.broken";
    readonly IMAGE_SRC_BROKEN: "images.src.broken";
    readonly LINK_REDIRECT_CHAIN: "links.redirect.chain_too_long";
};
export type EmittedCheckId = (typeof CHECK_IDS)[keyof typeof CHECK_IDS];
/** Uniform catalog metadata for every check, regardless of how it is evaluated. */
export interface CatalogCheckMeta {
    id: string;
    name: string;
    category: CheckCategory | 'schema';
    defaultSeverity: IssueSeverity;
    weight: number;
    description: string;
    technicalExplanation: string;
    businessImpact: string;
    suggestedFix: string;
    docUrl?: string;
}
/** Cross-page checks computed by the finalizer over set-based SQL. */
export declare const CROSS_PAGE_CHECKS: readonly CatalogCheckMeta[];
/** Every check the platform can emit, with catalog metadata. Seeded into `checks`. */
export declare const CATALOG_CHECKS: readonly CatalogCheckMeta[];
export declare function getCatalogCheck(id: string): CatalogCheckMeta | undefined;
