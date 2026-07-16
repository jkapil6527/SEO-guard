import { IssueSeverity } from '@seo-guardian/shared';
import { computePageScore, SEVERITY_MULTIPLIER } from './scoring';
import { getCheck } from './checks';
import type { RuleResult } from './types';

function result(
  ruleId: string,
  severity: IssueSeverity,
  status: RuleResult['status'] = 'fail',
): RuleResult {
  return {
    ruleId,
    ruleName: ruleId,
    severity,
    status,
    message: 'm',
    technicalExplanation: 't',
    suggestedFix: 's',
  };
}

describe('SEVERITY_MULTIPLIER', () => {
  it('matches docs/06 §4', () => {
    expect(SEVERITY_MULTIPLIER[IssueSeverity.Critical]).toBe(1.0);
    expect(SEVERITY_MULTIPLIER[IssueSeverity.High]).toBe(0.6);
    expect(SEVERITY_MULTIPLIER[IssueSeverity.Medium]).toBe(0.3);
    expect(SEVERITY_MULTIPLIER[IssueSeverity.Low]).toBe(0.1);
    expect(SEVERITY_MULTIPLIER[IssueSeverity.Info]).toBe(0);
  });
});

describe('computePageScore', () => {
  it('is 100 with no issues', () => {
    expect(computePageScore([])).toBe(100);
  });

  it('ignores pass and not_applicable results', () => {
    expect(
      computePageScore([
        result('technical.https.not_secure', IssueSeverity.Critical, 'pass'),
        result('links.internal.broken', IssueSeverity.Critical, 'not_applicable'),
      ]),
    ).toBe(100);
  });

  it('single critical of weight W deducts exactly W', () => {
    const id = 'technical.https.not_secure';
    const weight = getCheck(id)?.weight ?? 0;
    expect(weight).toBeGreaterThan(0);
    expect(computePageScore([result(id, IssueSeverity.Critical)])).toBe(100 - weight);
  });

  it('applies severity multiplier for non-critical', () => {
    const id = 'meta.description.missing'; // high
    const weight = getCheck(id)?.weight ?? 0;
    const expected = 100 - weight * SEVERITY_MULTIPLIER[IssueSeverity.High];
    expect(computePageScore([result(id, IssueSeverity.High)])).toBeCloseTo(expected, 6);
  });

  it('counts repeated instances once at full weight + log2 surcharge', () => {
    const id = 'images.alt.missing';
    const weight = getCheck(id)?.weight ?? 0;
    const multiplier = SEVERITY_MULTIPLIER[IssueSeverity.High];
    const four = [
      result(id, IssueSeverity.High),
      result(id, IssueSeverity.High),
      result(id, IssueSeverity.High),
      result(id, IssueSeverity.High),
    ];
    // effectiveWeight = W * (1 + log2(4)*0.1) = W * 1.2
    const expected = 100 - weight * (1 + Math.log2(4) * 0.1) * multiplier;
    expect(computePageScore(four)).toBeCloseTo(expected, 6);

    // A single instance uses full weight only (log2(1) = 0).
    const single = 100 - weight * multiplier;
    expect(computePageScore([result(id, IssueSeverity.High)])).toBeCloseTo(single, 6);
  });

  it('clamps to a floor of 0', () => {
    // Several distinct heavy critical checks overflow the deduction past 100.
    const heavy = [
      result('technical.https.not_secure', IssueSeverity.Critical),
      result('technical.status.4xx', IssueSeverity.Critical),
      result('technical.status.5xx', IssueSeverity.Critical),
      result('meta.robots.noindex', IssueSeverity.Critical),
      result('links.internal.broken', IssueSeverity.Critical),
      result('meta.canonical.multiple', IssueSeverity.Critical),
    ];
    expect(computePageScore(heavy)).toBe(0);
  });
});
