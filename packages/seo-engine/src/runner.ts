/**
 * Executes the single-page check catalog against extracted artifacts.
 *
 * Project overrides are applied AFTER checks run so raw engine output stays
 * project-independent and cacheable: disabled checks are skipped entirely and
 * severities are rewritten per `severityByCheckId`.
 *
 * Only actionable results (status 'fail' or 'warning') are returned — these are
 * the persisted issue set. 'pass' and 'not_applicable' results are intentionally
 * excluded (they carry no issue to store and are not scored).
 */
import type { EngineOverrides, PageArtifacts, RuleResult, SiteContext } from './types';
import { CHECKS } from './checks';

export function runChecks(
  artifacts: PageArtifacts,
  site: SiteContext,
  overrides?: EngineOverrides,
): RuleResult[] {
  const disabled = overrides?.disabledCheckIds;
  const severityByCheckId = overrides?.severityByCheckId;
  const out: RuleResult[] = [];

  for (const check of CHECKS) {
    if (disabled?.has(check.id)) {
      continue;
    }
    const results = check.run(artifacts, site);
    const severityOverride = severityByCheckId?.get(check.id);
    for (const result of results) {
      if (result.status !== 'fail' && result.status !== 'warning') {
        continue;
      }
      out.push(severityOverride !== undefined ? { ...result, severity: severityOverride } : result);
    }
  }

  return out;
}
