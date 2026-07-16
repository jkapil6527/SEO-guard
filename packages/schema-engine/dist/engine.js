"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePageSchema = validatePageSchema;
const shared_1 = require("@seo-guardian/shared");
const extract_1 = require("./extract");
const profiles_1 = require("./packs/profiles");
const vocab_1 = require("./packs/vocab");
const rich_results_1 = require("./rich-results");
const validate_1 = require("./validate");
/**
 * Top-level entry point: extract → validate → evaluate rich results → run
 * page-level checks → compute coverage and per-entity summaries. Deterministic
 * and zero-I/O; safe on untrusted markup.
 */
function validatePageSchema(html, _ctx, options) {
    const extraction = (0, extract_1.extractStructuredData)(html);
    const validations = [];
    const richResults = [];
    const summaries = [];
    for (const entity of extraction.entities) {
        const validation = (0, validate_1.validateEntity)(entity, vocab_1.VOCAB_PACK, profiles_1.PROFILE_PACK);
        validations.push(validation);
        const verdicts = (0, rich_results_1.evaluateRichResults)(entity, profiles_1.PROFILE_PACK, options);
        richResults.push({ entityId: entity.id, verdicts });
        summaries.push(toSummary(entity, validation, verdicts));
    }
    const pageResults = pageLevelChecks(extraction.entities);
    const coverage = computeCoverage(extraction.entities, validations, richResults, extraction.parseErrors.length);
    return {
        entities: extraction.entities,
        rawBlocks: extraction.rawBlocks,
        parseErrors: extraction.parseErrors,
        validations,
        richResults,
        pageResults,
        coverage,
        summaries,
    };
}
/** Duplicate and conflicting schema detection across the page. */
function pageLevelChecks(entities) {
    const out = [];
    // Exact duplicate entities (same hash) appearing more than once.
    const byHash = new Map();
    for (const e of entities) {
        const list = byHash.get(e.entityHash) ?? [];
        list.push(e);
        byHash.set(e.entityHash, list);
    }
    for (const [, group] of byHash) {
        if (group.length > 1) {
            const type = group[0].type;
            out.push({
                checkId: 'schema.page.duplicate',
                severity: shared_1.IssueSeverity.Low,
                status: 'warning',
                entityType: type,
                message: `Duplicate ${type} schema appears ${group.length} times on the page.`,
                technicalExplanation: 'The same structured-data entity is repeated identically, which is redundant.',
                suggestedFix: 'Emit a single instance of the entity per page.',
                specUrl: 'https://developers.google.com/search/docs/appearance/structured-data',
            });
        }
    }
    // Conflicting singletons: types that should appear at most once per page.
    const SINGLETON = ['WebSite', 'Organization', 'BreadcrumbList', 'WebPage'];
    for (const type of SINGLETON) {
        const matching = entities.filter((e) => e.types.includes(type));
        if (matching.length > 1 && new Set(matching.map((e) => e.entityHash)).size > 1) {
            out.push({
                checkId: 'schema.page.conflicting',
                severity: shared_1.IssueSeverity.Medium,
                status: 'warning',
                entityType: type,
                message: `Multiple differing ${type} entities on one page.`,
                technicalExplanation: `${type} is expected once per page; conflicting instances confuse search engines.`,
                suggestedFix: `Consolidate into a single ${type} entity.`,
                specUrl: `https://schema.org/${type}`,
            });
        }
    }
    return out;
}
function computeCoverage(entities, validations, richResults, invalidJsonCount) {
    const typeCounts = {};
    for (const e of entities) {
        const t = e.type || 'Unknown';
        typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const validCount = validations.filter((v) => v.status === 'valid').length;
    const warningCount = validations.filter((v) => v.status === 'warnings').length;
    const errorCount = validations.filter((v) => v.status === 'errors').length;
    const richEligibleCount = richResults.filter((r) => r.verdicts.some((v) => v.eligible)).length;
    return {
        entityCount: entities.length,
        validCount,
        warningCount,
        errorCount,
        invalidJsonCount,
        typeCounts,
        richEligibleCount,
        hasSchema: entities.length > 0,
    };
}
function toSummary(entity, validation, verdicts) {
    return {
        type: entity.type,
        format: entity.format,
        identity: entity.identity,
        entityHash: entity.entityHash,
        status: validation.status,
        properties: entity.properties,
        richProfiles: verdicts.map((v) => ({ profile: v.profile, status: v.status })),
    };
}
//# sourceMappingURL=engine.js.map