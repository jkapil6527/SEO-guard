import { IssueSeverity } from '@seo-guardian/shared';
import { extractStructuredData } from './extract';
import { PROFILE_PACK } from './packs/profiles';
import { VOCAB_PACK } from './packs/vocab';
import { evaluateRichResults } from './rich-results';
import type {
  EntityValidation,
  RichResultVerdict,
  SchemaCoverage,
  SchemaEntity,
  SchemaEntitySummary,
  SchemaOptions,
  SchemaPageContext,
  SchemaPageResult,
  SchemaValidationResult,
} from './types';
import { validateEntity } from './validate';

/**
 * Top-level entry point: extract → validate → evaluate rich results → run
 * page-level checks → compute coverage and per-entity summaries. Deterministic
 * and zero-I/O; safe on untrusted markup.
 */
export function validatePageSchema(
  html: string,
  _ctx: SchemaPageContext,
  options?: SchemaOptions,
): SchemaPageResult {
  const extraction = extractStructuredData(html);
  const validations: EntityValidation[] = [];
  const richResults: Array<{ entityId: string; verdicts: RichResultVerdict[] }> = [];
  const summaries: SchemaEntitySummary[] = [];

  for (const entity of extraction.entities) {
    const validation = validateEntity(entity, VOCAB_PACK, PROFILE_PACK);
    validations.push(validation);
    const verdicts = evaluateRichResults(entity, PROFILE_PACK, options);
    richResults.push({ entityId: entity.id, verdicts });
    summaries.push(toSummary(entity, validation, verdicts));
  }

  const pageResults = pageLevelChecks(extraction.entities);
  const coverage = computeCoverage(
    extraction.entities,
    validations,
    richResults,
    extraction.parseErrors.length,
  );

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
function pageLevelChecks(entities: SchemaEntity[]): SchemaValidationResult[] {
  const out: SchemaValidationResult[] = [];

  // Exact duplicate entities (same hash) appearing more than once.
  const byHash = new Map<string, SchemaEntity[]>();
  for (const e of entities) {
    const list = byHash.get(e.entityHash) ?? [];
    list.push(e);
    byHash.set(e.entityHash, list);
  }
  for (const [, group] of byHash) {
    if (group.length > 1) {
      const type = group[0]!.type;
      out.push({
        checkId: 'schema.page.duplicate',
        severity: IssueSeverity.Low,
        status: 'warning',
        entityType: type,
        message: `Duplicate ${type} schema appears ${group.length} times on the page.`,
        technicalExplanation:
          'The same structured-data entity is repeated identically, which is redundant.',
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
        severity: IssueSeverity.Medium,
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

function computeCoverage(
  entities: SchemaEntity[],
  validations: EntityValidation[],
  richResults: Array<{ entityId: string; verdicts: RichResultVerdict[] }>,
  invalidJsonCount: number,
): SchemaCoverage {
  const typeCounts: Record<string, number> = {};
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

function toSummary(
  entity: SchemaEntity,
  validation: EntityValidation,
  verdicts: RichResultVerdict[],
): SchemaEntitySummary {
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
