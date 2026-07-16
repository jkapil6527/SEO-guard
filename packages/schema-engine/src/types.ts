/**
 * Public contract of @seo-guardian/schema-engine. The engine is a deterministic,
 * zero-I/O function of fetched HTML: it extracts structured data (JSON-LD,
 * Microdata, RDFa), normalizes it into an entity graph, validates each entity
 * against a versioned Schema.org vocabulary pack, evaluates Google rich-result
 * eligibility against a versioned profile pack, and diffs entity sets between
 * crawls. Nothing here performs I/O.
 */
import type { IssueSeverity } from '@seo-guardian/shared';

// ---------- extraction ----------

export type SchemaFormat = 'json-ld' | 'microdata' | 'rdfa';

/** A raw structured-data block exactly as found on the page (pre-normalization). */
export interface RawSchemaBlock {
  format: SchemaFormat;
  /** Original serialized text (JSON-LD script body, or a serialized node subtree). */
  raw: string;
  /** Best-effort locator: script index or a CSS-ish path. */
  location: string;
}

/** A normalized structured-data value. Nested entities are represented inline. */
export type SchemaValue = string | number | boolean | SchemaEntity | SchemaRef | SchemaValue[];

/** An unresolved reference to another entity by @id. */
export interface SchemaRef {
  ref: string;
}

export interface SchemaEntity {
  /** Stable within-page id: the entity's @id, else a synthesized `_:b<n>`. */
  id: string;
  /** Primary type (first of @type). */
  type: string;
  /** All declared @type values (schema.org short names, e.g. "Article"). */
  types: string[];
  format: SchemaFormat;
  /** Normalized properties keyed by schema.org short property name. */
  properties: Record<string, SchemaValue>;
  /** Identity hint for cross-crawl matching: @id, else url, else name; null if none. */
  identity: string | null;
  /** sha256 hex of the canonicalized entity — stable across crawls for diffing. */
  entityHash: string;
  /** The raw block this entity was parsed from. */
  source: RawSchemaBlock;
}

export interface ExtractionResult {
  entities: SchemaEntity[];
  rawBlocks: RawSchemaBlock[];
  /** Blocks that could not be parsed (e.g. invalid JSON-LD) — recorded, never thrown. */
  parseErrors: Array<{ format: SchemaFormat; message: string; raw: string; location: string }>;
}

// ---------- validation ----------

export type ValidationStatus = 'pass' | 'fail' | 'warning';

export interface SchemaValidationResult {
  /** e.g. 'schema.article.required.author' */
  checkId: string;
  severity: IssueSeverity;
  status: ValidationStatus;
  message: string;
  technicalExplanation: string;
  suggestedFix: string;
  /** Link to the relevant Schema.org (or Google) specification. */
  specUrl: string;
  /** The property this result concerns, when applicable. */
  property?: string;
  entityType: string;
}

export type EntityStatus = 'valid' | 'warnings' | 'errors' | 'invalid_json';

export interface EntityValidation {
  entityId: string;
  entityType: string;
  status: EntityStatus;
  results: SchemaValidationResult[];
  detectedProperties: string[];
  requiredProperties: string[];
  recommendedProperties: string[];
  missingRequired: string[];
  missingRecommended: string[];
  invalidProperties: string[];
  deprecatedProperties: string[];
  /** 0..1 — lowered by parse recovery, type inference, and heuristic coercions. */
  confidence: number;
}

// ---------- rich results ----------

export type RichResultStatus = 'eligible' | 'eligible_with_warnings' | 'ineligible';

export interface RichResultVerdict {
  /** Google rich-result profile, e.g. 'Article', 'Product', 'FAQ'. */
  profile: string;
  eligible: boolean;
  status: RichResultStatus;
  missingRequired: string[];
  missingRecommended: string[];
  errors: string[];
  warnings: string[];
  /** Human-readable reason for the verdict. */
  reason: string;
}

// ---------- page-level ----------

export interface SchemaPageContext {
  url: string;
  finalUrl: string;
  headers: Record<string, string>;
}

/** A compact per-entity summary persisted to the DB and used for diffing. */
export interface SchemaEntitySummary {
  type: string;
  format: SchemaFormat;
  identity: string | null;
  entityHash: string;
  status: EntityStatus;
  properties: Record<string, SchemaValue>;
  richProfiles: Array<{ profile: string; status: RichResultStatus }>;
}

export interface SchemaCoverage {
  entityCount: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  invalidJsonCount: number;
  typeCounts: Record<string, number>;
  richEligibleCount: number;
  hasSchema: boolean;
}

export interface SchemaPageResult {
  entities: SchemaEntity[];
  rawBlocks: RawSchemaBlock[];
  parseErrors: ExtractionResult['parseErrors'];
  validations: EntityValidation[];
  richResults: Array<{ entityId: string; verdicts: RichResultVerdict[] }>;
  /** Page-level checks: duplicate schemas, conflicting schemas. */
  pageResults: SchemaValidationResult[];
  coverage: SchemaCoverage;
  /** Per-entity summaries for persistence and diffing. */
  summaries: SchemaEntitySummary[];
}

export interface SchemaOptions {
  /** Disable specific rich-result profiles by name. */
  disabledProfiles?: ReadonlySet<string>;
}

// ---------- change detection ----------

export type SchemaChangeType =
  | 'schema_added'
  | 'schema_removed'
  | 'schema_modified'
  | 'property_added'
  | 'property_removed'
  | 'property_value_changed'
  | 'rich_result_changed';

export interface SchemaChange {
  type: SchemaChangeType;
  entityType: string;
  identity: string | null;
  property?: string;
  before?: unknown;
  after?: unknown;
  severity: IssueSeverity;
  message: string;
}

// ---------- vocabulary & profile packs ----------

/** Expected value type(s) for a property; 'Text','URL','Date','DateTime','Number',
 *  'Boolean', a schema type name, or an enumeration name. */
export type ExpectedType = string;

export interface PropertySpec {
  /** Expected value types (union). */
  expected: ExpectedType[];
  /** Marks the property superseded/deprecated by schema.org. */
  deprecated?: boolean;
}

export interface VocabTypeSpec {
  /** Parent types (schema.org short names) for inheritance of properties. */
  parents: string[];
  /** Properties defined directly on this type. */
  properties: Record<string, PropertySpec>;
}

export interface VocabPack {
  version: string;
  /** schema.org type specs keyed by short name. */
  types: Record<string, VocabTypeSpec>;
  /** Enumerations keyed by name → allowed member short-names/URLs. */
  enumerations: Record<string, string[]>;
  /** Deprecated property names (global), superseded by schema.org. */
  deprecatedProperties: string[];
}

export interface ProfilePropertyRule {
  name: string;
  requirement: 'required' | 'recommended';
  /** Optional value constraint description used in messages. */
  note?: string;
}

export interface RichResultProfile {
  /** Profile name, e.g. 'Article'. */
  name: string;
  /** schema.org types this profile applies to (an entity matching any is evaluated). */
  appliesTo: string[];
  properties: ProfilePropertyRule[];
  docUrl: string;
}

export interface ProfilePack {
  version: string;
  profiles: RichResultProfile[];
}
