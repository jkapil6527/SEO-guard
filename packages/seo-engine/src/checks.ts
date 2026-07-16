/**
 * Aggregated single-page Technical-SEO check catalog. Ids are globally unique
 * `category.subject.condition` strings; the catalog seeds the checks table.
 */
import type { CheckDefinition } from './types';
import { metaChecks } from './checks/meta';
import { headingChecks } from './checks/headings';
import { imageChecks } from './checks/images';
import { linkChecks } from './checks/links';
import { technicalChecks } from './checks/technical';
import { socialChecks } from './checks/social';

const ALL_CHECKS: CheckDefinition[] = [
  ...metaChecks,
  ...headingChecks,
  ...imageChecks,
  ...linkChecks,
  ...technicalChecks,
  ...socialChecks,
];

const CHECK_INDEX = new Map<string, CheckDefinition>();
for (const check of ALL_CHECKS) {
  if (CHECK_INDEX.has(check.id)) {
    throw new Error(`Duplicate check id in catalog: ${check.id}`);
  }
  CHECK_INDEX.set(check.id, check);
}

export const CHECKS: readonly CheckDefinition[] = ALL_CHECKS;

/** Looks up a check definition by id, or undefined when unknown. */
export function getCheck(id: string): CheckDefinition | undefined {
  return CHECK_INDEX.get(id);
}
