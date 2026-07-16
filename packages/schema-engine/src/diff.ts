import { IssueSeverity } from '@seo-guardian/shared';
import type { SchemaChange, SchemaEntitySummary, SchemaValue } from './types';

/**
 * Diffs the schema entities of one page between two crawls. Entities are matched
 * by (type, identity) when an identity exists, else by type + entity hash. The
 * result powers historical schema-change reports. Pure.
 *
 * Severity policy: removing an entity or a previously-present property is High
 * (it can drop a rich result); additions and value changes are Info/Low.
 */
export function diffPageSchema(
  before: SchemaEntitySummary[],
  after: SchemaEntitySummary[],
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const beforeByKey = indexByKey(before);
  const afterByKey = indexByKey(after);

  // Removed and modified.
  for (const [key, prev] of beforeByKey) {
    const curr = afterByKey.get(key);
    if (!curr) {
      changes.push({
        type: 'schema_removed',
        entityType: prev.type,
        identity: prev.identity,
        before: summaryRef(prev),
        severity: IssueSeverity.High,
        message: `${prev.type} schema was removed.`,
      });
      continue;
    }
    if (curr.entityHash !== prev.entityHash) {
      changes.push({
        type: 'schema_modified',
        entityType: prev.type,
        identity: prev.identity,
        severity: IssueSeverity.Medium,
        message: `${prev.type} schema changed.`,
      });
      changes.push(...propertyDiff(prev, curr));
    }
    changes.push(...richResultDiff(prev, curr));
  }

  // Added.
  for (const [key, curr] of afterByKey) {
    if (!beforeByKey.has(key)) {
      changes.push({
        type: 'schema_added',
        entityType: curr.type,
        identity: curr.identity,
        after: summaryRef(curr),
        severity: IssueSeverity.Info,
        message: `${curr.type} schema was added.`,
      });
    }
  }

  return changes;
}

function propertyDiff(prev: SchemaEntitySummary, curr: SchemaEntitySummary): SchemaChange[] {
  const out: SchemaChange[] = [];
  const keys = new Set([...Object.keys(prev.properties), ...Object.keys(curr.properties)]);
  for (const key of keys) {
    const a = prev.properties[key];
    const b = curr.properties[key];
    const aPresent = isPresent(a);
    const bPresent = isPresent(b);
    if (aPresent && !bPresent) {
      out.push({
        type: 'property_removed',
        entityType: prev.type,
        identity: prev.identity,
        property: key,
        before: scalarize(a),
        severity: IssueSeverity.High,
        message: `Property "${key}" removed from ${prev.type} schema.`,
      });
    } else if (!aPresent && bPresent) {
      out.push({
        type: 'property_added',
        entityType: curr.type,
        identity: curr.identity,
        property: key,
        after: scalarize(b),
        severity: IssueSeverity.Info,
        message: `Property "${key}" added to ${curr.type} schema.`,
      });
    } else if (aPresent && bPresent && !valuesEqual(a, b)) {
      out.push({
        type: 'property_value_changed',
        entityType: curr.type,
        identity: curr.identity,
        property: key,
        before: scalarize(a),
        after: scalarize(b),
        severity: IssueSeverity.Low,
        message: `Property "${key}" value changed on ${curr.type} schema.`,
      });
    }
  }
  return out;
}

function richResultDiff(prev: SchemaEntitySummary, curr: SchemaEntitySummary): SchemaChange[] {
  const out: SchemaChange[] = [];
  const prevByProfile = new Map(prev.richProfiles.map((r) => [r.profile, r.status]));
  const currByProfile = new Map(curr.richProfiles.map((r) => [r.profile, r.status]));
  for (const [profile, prevStatus] of prevByProfile) {
    const currStatus = currByProfile.get(profile);
    if (currStatus && currStatus !== prevStatus) {
      const worsened = prevStatus === 'eligible' && currStatus === 'ineligible';
      out.push({
        type: 'rich_result_changed',
        entityType: curr.type,
        identity: curr.identity,
        property: profile,
        before: prevStatus,
        after: currStatus,
        severity: worsened ? IssueSeverity.High : IssueSeverity.Low,
        message: `${profile} rich-result eligibility changed from ${prevStatus} to ${currStatus}.`,
      });
    }
  }
  return out;
}

function indexByKey(summaries: SchemaEntitySummary[]): Map<string, SchemaEntitySummary> {
  const out = new Map<string, SchemaEntitySummary>();
  for (const s of summaries) {
    const key = s.identity ? `${s.type}::${s.identity}` : `${s.type}::${s.entityHash}`;
    // On duplicate keys, keep the first (page-level duplicate detection handles repeats).
    if (!out.has(key)) out.set(key, s);
  }
  return out;
}

function isPresent(v: SchemaValue | undefined): boolean {
  if (v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function valuesEqual(a: SchemaValue | undefined, b: SchemaValue | undefined): boolean {
  return JSON.stringify(scalarize(a)) === JSON.stringify(scalarize(b));
}

/** Reduce a value to a comparable/serializable scalar shape for change records. */
function scalarize(v: SchemaValue | undefined): unknown {
  if (v === undefined || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(scalarize);
  if ('ref' in v) return { ref: (v as { ref: string }).ref };
  const entity = v as { type?: string; identity?: string | null };
  return { type: entity.type, identity: entity.identity ?? null };
}

function summaryRef(s: SchemaEntitySummary): unknown {
  return { type: s.type, identity: s.identity, format: s.format };
}
