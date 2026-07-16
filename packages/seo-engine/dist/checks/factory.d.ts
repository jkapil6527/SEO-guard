/**
 * Internal helper that turns a compact check spec into a full CheckDefinition.
 * The spec's `evaluate` returns only per-instance status/message/evidence; the
 * factory backfills ruleId/ruleName/severity/explanation/fix from the metadata.
 */
import type { CheckCategory, CheckDefinition, PageArtifacts, RuleStatus, SiteContext } from '../types';
import type { IssueSeverity } from '@seo-guardian/shared';
export interface PartialResult {
    status: RuleStatus;
    message: string;
    affectedElement?: string;
    metadata?: Record<string, unknown>;
}
export interface CheckSpec {
    id: string;
    name: string;
    category: CheckCategory;
    defaultSeverity: IssueSeverity;
    weight: number;
    description: string;
    technicalExplanation: string;
    suggestedFix: string;
    docUrl?: string;
    evaluate(artifacts: PageArtifacts, site: SiteContext): PartialResult[];
}
export declare function createCheck(spec: CheckSpec): CheckDefinition;
/** Convenience: a single passing result for a satisfied check. */
export declare function passed(message: string): PartialResult[];
