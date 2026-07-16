import { IssueSeverity } from '@seo-guardian/shared';
import type {
  EntityValidation,
  ProfilePack,
  PropertySpec,
  SchemaEntity,
  SchemaValidationResult,
  SchemaValue,
  VocabPack,
} from './types';
import { isBooleanish, isHttpUrl, isInteger, isIsoDate, isNumeric } from './util';

const SPEC = 'https://schema.org';

/** Value types that are validated by format rather than by entity type. */
const SCALAR = new Set(['Text', 'URL', 'Date', 'DateTime', 'Time', 'Number', 'Integer', 'Boolean']);

/** Global properties allowed on any type (from Thing / JSON-LD keywords). */
const GLOBAL_PROPS = new Set([
  'additionalType',
  'identifier',
  'sameAs',
  'url',
  'name',
  'description',
  'image',
  'alternateName',
  'mainEntityOfPage',
  'potentialAction',
  'subjectOf',
]);

/**
 * Validates a single entity (and its nested entities) against the vocabulary
 * pack, and derives required/recommended coverage from the rich-result profiles
 * that apply to the entity's type. Pure.
 */
export function validateEntity(
  entity: SchemaEntity,
  vocab: VocabPack,
  profiles: ProfilePack,
  isRoot = true,
): EntityValidation {
  const results: SchemaValidationResult[] = [];
  const invalidProperties: string[] = [];
  const deprecatedProperties: string[] = [];
  let confidence = 1;

  const knownType = resolveKnownType(entity.types, vocab);
  const entityType = knownType ?? entity.type ?? 'Thing';

  if (entity.types.length === 0) {
    results.push(
      make('schema.untyped', IssueSeverity.Low, 'warning', entityType, {
        message: 'Structured-data item has no @type.',
        technicalExplanation:
          'An item without a type cannot be matched to a Schema.org definition or a rich result.',
        suggestedFix: 'Add an appropriate @type (e.g. "Article", "Product").',
        specUrl: `${SPEC}/Thing`,
      }),
    );
    confidence -= 0.2;
  } else if (!knownType) {
    results.push(
      make('schema.unknown_type', IssueSeverity.Low, 'warning', entity.type, {
        message: `Unrecognised type "${entity.type}".`,
        technicalExplanation:
          'The type is not in the vocabulary pack; only structural checks are applied.',
        suggestedFix: 'Verify the type name against schema.org, or extend the vocabulary pack.',
        specUrl: `${SPEC}/${encodeURIComponent(entity.type)}`,
      }),
    );
    confidence -= 0.2;
  }

  if (entity.format !== 'json-ld') confidence -= 0.05;

  const validProps = knownType ? collectProperties(knownType, vocab) : null;

  for (const [prop, value] of Object.entries(entity.properties)) {
    const spec = validProps?.get(prop);

    if (vocab.deprecatedProperties.includes(prop)) {
      deprecatedProperties.push(prop);
      results.push(
        make(
          `schema.${lc(entityType)}.deprecated.${prop}`,
          IssueSeverity.Low,
          'warning',
          entityType,
          {
            message: `Property "${prop}" is deprecated.`,
            technicalExplanation:
              'Schema.org has superseded this property; search engines may ignore it.',
            suggestedFix: `Replace "${prop}" with its current schema.org equivalent.`,
            specUrl: `${SPEC}/${prop}`,
            property: prop,
          },
        ),
      );
    }

    if (knownType && !spec && !GLOBAL_PROPS.has(prop)) {
      invalidProperties.push(prop);
      results.push(
        make(
          `schema.${lc(entityType)}.invalid_property.${prop}`,
          IssueSeverity.Low,
          'warning',
          entityType,
          {
            message: `Property "${prop}" is not defined for ${entityType}.`,
            technicalExplanation: `"${prop}" is not a property of ${entityType} or its ancestors in the vocabulary.`,
            suggestedFix: `Remove "${prop}" or move it to an entity type that defines it.`,
            specUrl: `${SPEC}/${entityType}`,
            property: prop,
          },
        ),
      );
      continue;
    }

    const effectiveSpec = spec ?? (GLOBAL_PROPS.has(prop) ? thingSpec(prop, vocab) : undefined);
    if (effectiveSpec) {
      const typeResults = validateValueType(entityType, prop, value, effectiveSpec, vocab);
      results.push(...typeResults);
      if (typeResults.some((r) => r.status === 'fail')) invalidProperties.push(prop);
    }

    // Recurse into nested entities so their structural issues surface on the
    // parent record. Nested entities are NOT evaluated for rich-result
    // required/recommended coverage — that applies to the page's primary entity.
    for (const nested of nestedEntities(value)) {
      const child = validateEntity(nested, vocab, profiles, false);
      results.push(...child.results);
      confidence = Math.min(confidence, child.confidence);
    }
  }

  // Required / recommended coverage from applicable rich-result profiles (root only).
  const { required, recommended } = isRoot
    ? profileExpectations(entity, profiles)
    : { required: [] as string[], recommended: [] as string[] };
  const detected = Object.keys(entity.properties);
  const missingRequired = required.filter((p) => !hasProperty(entity, p));
  const missingRecommended = recommended.filter((p) => !hasProperty(entity, p));

  for (const p of missingRequired) {
    results.push(
      make(`schema.${lc(entityType)}.required.${p}`, IssueSeverity.High, 'fail', entityType, {
        message: `Missing required property "${p}".`,
        technicalExplanation: `Google requires "${p}" for the ${entityType} rich result; without it the item is ineligible.`,
        suggestedFix: `Add the "${p}" property to the ${entityType} markup.`,
        specUrl: `${SPEC}/${entityType}`,
        property: p,
      }),
    );
  }
  for (const p of missingRecommended) {
    results.push(
      make(`schema.${lc(entityType)}.recommended.${p}`, IssueSeverity.Low, 'warning', entityType, {
        message: `Missing recommended property "${p}".`,
        technicalExplanation: `"${p}" is recommended for the ${entityType} rich result and improves presentation.`,
        suggestedFix: `Add the "${p}" property where available.`,
        specUrl: `${SPEC}/${entityType}`,
        property: p,
      }),
    );
  }

  const status = results.some((r) => r.status === 'fail')
    ? 'errors'
    : results.some((r) => r.status === 'warning')
      ? 'warnings'
      : 'valid';

  return {
    entityId: entity.id,
    entityType,
    status,
    results,
    detectedProperties: detected,
    requiredProperties: required,
    recommendedProperties: recommended,
    missingRequired,
    missingRecommended,
    invalidProperties: [...new Set(invalidProperties)],
    deprecatedProperties: [...new Set(deprecatedProperties)],
    confidence: Math.max(0, Number(confidence.toFixed(3))),
  };
}

function validateValueType(
  entityType: string,
  prop: string,
  value: SchemaValue,
  spec: PropertySpec,
  vocab: VocabPack,
): SchemaValidationResult[] {
  const out: SchemaValidationResult[] = [];
  for (const single of asArray(value)) {
    if (!matchesExpected(single, spec.expected, vocab)) {
      const expected = spec.expected.join(' | ');
      out.push(
        make(`schema.${lc(entityType)}.type.${prop}`, IssueSeverity.Medium, 'fail', entityType, {
          message: `Property "${prop}" has an invalid value type (expected ${expected}).`,
          technicalExplanation: `The value ${describe(single)} does not satisfy the expected type(s) ${expected}.`,
          suggestedFix: `Provide "${prop}" as ${expected}.`,
          specUrl: `${SPEC}/${prop}`,
          property: prop,
        }),
      );
    }
  }
  return out;
}

function matchesExpected(value: SchemaValue, expected: string[], vocab: VocabPack): boolean {
  return expected.some((exp) => matchesOne(value, exp, vocab));
}

function matchesOne(value: SchemaValue, expected: string, vocab: VocabPack): boolean {
  // Enumerations: value must be a member (short name or schema.org URL of a member).
  const enumMembers = vocab.enumerations[expected];
  if (enumMembers) {
    const s = typeof value === 'string' ? value : '';
    const short = s.replace(/^https?:\/\/schema\.org\//i, '');
    return enumMembers.includes(short) || enumMembers.includes(s);
  }
  if (SCALAR.has(expected)) return matchesScalar(value, expected);
  // Expected an entity type: the value must be a (possibly nested) entity that is-a expected.
  if (isEntity(value))
    return (
      isSubtypeOf(value.type, expected, vocab) ||
      value.types.some((t) => isSubtypeOf(t, expected, vocab))
    );
  if (isRef(value)) return true; // reference resolved elsewhere; accept
  // A bare string is only an acceptable shorthand for an entity when it is a URL
  // (entity-by-reference). Free-form strings must be caught by other expected types
  // (e.g. an explicit 'Text' in the union) rather than silently passing here.
  if (typeof value === 'string') return isHttpUrl(value);
  return false;
}

function matchesScalar(value: SchemaValue, expected: string): boolean {
  switch (expected) {
    case 'Text':
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    case 'URL':
      return typeof value === 'string' && isHttpUrl(value);
    case 'Date':
    case 'DateTime':
    case 'Time':
      return typeof value === 'string' && isIsoDate(value);
    case 'Number':
      return isNumeric(value);
    case 'Integer':
      return isInteger(value);
    case 'Boolean':
      return isBooleanish(value);
    default:
      return false;
  }
}

// ---------------- vocabulary helpers ----------------

function resolveKnownType(types: string[], vocab: VocabPack): string | null {
  for (const t of types) if (vocab.types[t]) return t;
  return null;
}

function collectProperties(type: string, vocab: VocabPack): Map<string, PropertySpec> {
  const out = new Map<string, PropertySpec>();
  const seen = new Set<string>();
  const walk = (t: string): void => {
    if (seen.has(t)) return;
    seen.add(t);
    const spec = vocab.types[t];
    if (!spec) return;
    for (const [name, ps] of Object.entries(spec.properties)) if (!out.has(name)) out.set(name, ps);
    for (const parent of spec.parents) walk(parent);
  };
  walk(type);
  return out;
}

function thingSpec(prop: string, vocab: VocabPack): PropertySpec | undefined {
  return vocab.types['Thing']?.properties[prop];
}

function isSubtypeOf(type: string, ancestor: string, vocab: VocabPack): boolean {
  if (!type) return false;
  if (type === ancestor) return true;
  const seen = new Set<string>();
  const walk = (t: string): boolean => {
    if (t === ancestor) return true;
    if (seen.has(t)) return false;
    seen.add(t);
    const spec = vocab.types[t];
    if (!spec) return false;
    return spec.parents.some(walk);
  };
  return walk(type);
}

// ---------------- profile expectations ----------------

function profileExpectations(
  entity: SchemaEntity,
  profiles: ProfilePack,
): { required: string[]; recommended: string[] } {
  const required = new Set<string>();
  const recommended = new Set<string>();
  for (const profile of profiles.profiles) {
    if (!profile.appliesTo.some((t) => entity.types.includes(t))) continue;
    for (const rule of profile.properties) {
      if (rule.requirement === 'required') required.add(rule.name);
      else recommended.add(rule.name);
    }
  }
  // A property that is both required and recommended across profiles counts as required.
  for (const r of required) recommended.delete(r);
  return { required: [...required], recommended: [...recommended] };
}

// ---------------- value helpers ----------------

function hasProperty(entity: SchemaEntity, prop: string): boolean {
  const v = entity.properties[prop];
  if (v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function nestedEntities(value: SchemaValue): SchemaEntity[] {
  if (isEntity(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(nestedEntities);
  return [];
}

function asArray(value: SchemaValue): SchemaValue[] {
  return Array.isArray(value) ? value : [value];
}

function isEntity(value: SchemaValue): value is SchemaEntity {
  return !!value && typeof value === 'object' && !Array.isArray(value) && 'entityHash' in value;
}

function isRef(value: SchemaValue): value is { ref: string } {
  return !!value && typeof value === 'object' && !Array.isArray(value) && 'ref' in value;
}

function describe(value: SchemaValue): string {
  if (isEntity(value)) return `<${value.type}>`;
  if (isRef(value)) return `<ref ${value.ref}>`;
  if (Array.isArray(value)) return '<array>';
  return JSON.stringify(value);
}

function lc(type: string): string {
  return type.toLowerCase();
}

function make(
  checkId: string,
  severity: IssueSeverity,
  status: 'pass' | 'fail' | 'warning',
  entityType: string,
  rest: Omit<SchemaValidationResult, 'checkId' | 'severity' | 'status' | 'entityType'>,
): SchemaValidationResult {
  return { checkId, severity, status, entityType, ...rest };
}
