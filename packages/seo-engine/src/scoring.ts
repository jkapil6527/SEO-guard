/**
 * Per-page scoring per docs/06 §4.
 *
 *   pageScore = 100 − Σ over distinct failed checks( effectiveWeight × severityMultiplier )
 *   effectiveWeight = checkWeight × (1 + log2(instanceCount) × 0.1)
 *   clamped to [0, 100]
 *
 * Repeated instances of one check on a page count once at full weight plus a
 * log2(instanceCount) × 10% surcharge, so a page with 200 missing alts is worse
 * than one — but not 200× worse.
 */
import { IssueSeverity } from '@seo-guardian/shared';
import type { RuleResult } from './types';
import { getCheck } from './checks';

export const SEVERITY_MULTIPLIER: Record<IssueSeverity, number> = {
  [IssueSeverity.Critical]: 1.0,
  [IssueSeverity.High]: 0.6,
  [IssueSeverity.Medium]: 0.3,
  [IssueSeverity.Low]: 0.1,
  [IssueSeverity.Info]: 0,
};

export function computePageScore(results: readonly RuleResult[]): number {
  const groups = new Map<string, RuleResult[]>();
  for (const result of results) {
    if (result.status !== 'fail' && result.status !== 'warning') {
      continue;
    }
    const existing = groups.get(result.ruleId);
    if (existing === undefined) {
      groups.set(result.ruleId, [result]);
    } else {
      existing.push(result);
    }
  }

  let score = 100;
  for (const [ruleId, groupResults] of groups) {
    const first = groupResults[0];
    if (first === undefined) {
      continue;
    }
    const weight = getCheck(ruleId)?.weight ?? 0;
    const multiplier = SEVERITY_MULTIPLIER[first.severity];
    const instanceCount = groupResults.length;
    const effectiveWeight = weight * (1 + Math.log2(instanceCount) * 0.1);
    score -= effectiveWeight * multiplier;
  }

  return Math.max(0, Math.min(100, score));
}
