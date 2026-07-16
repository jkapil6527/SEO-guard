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
export declare const SEVERITY_MULTIPLIER: Record<IssueSeverity, number>;
export declare function computePageScore(results: readonly RuleResult[]): number;
