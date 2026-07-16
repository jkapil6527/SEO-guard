"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATALOG_CHECKS = exports.CROSS_PAGE_CHECKS = exports.CHECK_IDS = void 0;
exports.getCatalogCheck = getCatalogCheck;
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
const shared_1 = require("@seo-guardian/shared");
const checks_1 = require("./checks");
/** Stable ids for checks emitted outside the per-page engine. */
exports.CHECK_IDS = {
    // runtime (crawler)
    FETCH_FAILED: 'technical.fetch.failed',
    STATUS_ERROR: 'technical.status.error',
    // cross-page (finalizer) — duplicates are finalizer-only
    DUPLICATE_TITLE: 'duplicate.title',
    DUPLICATE_DESCRIPTION: 'duplicate.description',
    DUPLICATE_H1: 'duplicate.h1',
    // broken-link findings share the per-page check ids (same finding, whether
    // detected per page with link statuses or site-wide at finalize).
    LINK_INTERNAL_BROKEN: 'links.internal.broken',
    LINK_EXTERNAL_BROKEN: 'links.external.broken',
    // Link verification is asynchronous, so these can only be evaluated at
    // finalize — the per-page runner never has link statuses to work with.
    IMAGE_SRC_BROKEN: 'images.src.broken',
    LINK_REDIRECT_CHAIN: 'links.redirect.chain_too_long',
};
const RUNTIME_CHECKS = [
    {
        id: exports.CHECK_IDS.FETCH_FAILED,
        name: 'Page could not be fetched',
        category: 'technical',
        defaultSeverity: shared_1.IssueSeverity.Critical,
        weight: 40,
        description: 'The crawler failed to retrieve the page (network, DNS, timeout, or blocked).',
        technicalExplanation: 'The HTTP request did not complete: DNS resolution, connection, TLS, or the response timed out or was blocked by the SSRF guard.',
        businessImpact: 'Unreachable pages drop out of search and lose their organic traffic entirely.',
        suggestedFix: 'Verify the URL resolves, the server responds, and the page is not blocking the crawler.',
    },
    {
        id: exports.CHECK_IDS.STATUS_ERROR,
        name: 'Page returned an error status',
        category: 'technical',
        defaultSeverity: shared_1.IssueSeverity.Critical,
        weight: 40,
        description: 'The page responded with a 4xx or 5xx HTTP status.',
        technicalExplanation: 'A non-success status (client or server error) means the page cannot be indexed and wastes crawl budget.',
        businessImpact: 'Error pages are removed from the index; users hitting them erode trust and rankings.',
        suggestedFix: 'Restore the page (200) or apply the correct redirect; remove dead URLs from sitemaps.',
    },
];
/** Cross-page checks computed by the finalizer over set-based SQL. */
exports.CROSS_PAGE_CHECKS = [
    {
        id: exports.CHECK_IDS.DUPLICATE_TITLE,
        name: 'Duplicate title across pages',
        category: 'meta',
        defaultSeverity: shared_1.IssueSeverity.High,
        weight: 15,
        description: 'Multiple pages share an identical <title>.',
        technicalExplanation: 'Titles are grouped by a normalized hash; a group larger than one means several pages present the same title to search engines.',
        businessImpact: 'Duplicate titles dilute relevance signals and can suppress pages in results.',
        suggestedFix: 'Give each page a unique, descriptive title reflecting its specific content.',
    },
    {
        id: exports.CHECK_IDS.DUPLICATE_DESCRIPTION,
        name: 'Duplicate meta description across pages',
        category: 'meta',
        defaultSeverity: shared_1.IssueSeverity.Medium,
        weight: 8,
        description: 'Multiple pages share an identical meta description.',
        technicalExplanation: 'Meta descriptions are grouped by a normalized hash across the crawl.',
        businessImpact: 'Duplicate descriptions weaken snippet relevance and click-through.',
        suggestedFix: 'Write a unique meta description summarising each page.',
    },
    {
        id: exports.CHECK_IDS.DUPLICATE_H1,
        name: 'Duplicate H1 across pages',
        category: 'headings',
        defaultSeverity: shared_1.IssueSeverity.Medium,
        weight: 8,
        description: 'Multiple pages share an identical H1 heading.',
        technicalExplanation: 'First-H1 text is grouped by a normalized hash across the crawl.',
        businessImpact: 'Duplicate primary headings blur topical differentiation between pages.',
        suggestedFix: 'Use a unique H1 that states each page’s specific topic.',
    },
];
function perPageCatalog() {
    return checks_1.CHECKS.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        defaultSeverity: c.defaultSeverity,
        weight: c.weight,
        description: c.description,
        technicalExplanation: c.technicalExplanation,
        businessImpact: c.description,
        suggestedFix: c.suggestedFix,
        docUrl: c.docUrl,
    }));
}
/** Every check the platform can emit, with catalog metadata. Seeded into `checks`. */
exports.CATALOG_CHECKS = [
    ...perPageCatalog(),
    ...exports.CROSS_PAGE_CHECKS,
    ...RUNTIME_CHECKS,
];
const BY_ID = new Map(exports.CATALOG_CHECKS.map((c) => [c.id, c]));
function getCatalogCheck(id) {
    return BY_ID.get(id);
}
//# sourceMappingURL=catalog.js.map