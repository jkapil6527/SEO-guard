/**
 * Internal helper that turns a compact check spec into a full CheckDefinition.
 * The spec's `evaluate` returns only per-instance status/message/evidence; the
 * factory backfills ruleId/ruleName/severity/explanation/fix from the metadata.
 */
import type {
  CheckCategory,
  CheckDefinition,
  PageArtifacts,
  RuleResult,
  RuleStatus,
  SiteContext,
} from '../types';
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

export function createCheck(spec: CheckSpec): CheckDefinition {
  const definition: CheckDefinition = {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    defaultSeverity: spec.defaultSeverity,
    weight: spec.weight,
    description: spec.description,
    technicalExplanation: spec.technicalExplanation,
    suggestedFix: spec.suggestedFix,
    run(artifacts: PageArtifacts, site: SiteContext): RuleResult[] {
      return spec.evaluate(artifacts, site).map((partial) => {
        const result: RuleResult = {
          ruleId: spec.id,
          ruleName: spec.name,
          severity: spec.defaultSeverity,
          status: partial.status,
          message: partial.message,
          technicalExplanation: spec.technicalExplanation,
          suggestedFix: spec.suggestedFix,
        };
        if (partial.affectedElement !== undefined) {
          result.affectedElement = partial.affectedElement;
        }
        if (partial.metadata !== undefined) {
          result.metadata = partial.metadata;
        }
        return result;
      });
    },
  };
  if (spec.docUrl !== undefined) {
    definition.docUrl = spec.docUrl;
  }
  return definition;
}

/** Convenience: a single passing result for a satisfied check. */
export function passed(message: string): PartialResult[] {
  return [{ status: 'pass', message }];
}
