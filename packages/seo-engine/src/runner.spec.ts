import { IssueSeverity } from '@seo-guardian/shared';
import { runChecks } from './runner';
import { makeArtifacts, makeSite } from './fixtures/context';

const site = makeSite();

describe('runChecks', () => {
  it('returns only fail/warning results (no pass/not_applicable)', () => {
    const results = runChecks(makeArtifacts({ title: null }), site);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(['fail', 'warning']).toContain(r.status);
    }
    expect(results.some((r) => r.ruleId === 'meta.title.missing')).toBe(true);
  });

  it('a clean page produces no issues from the deterministic checks', () => {
    const results = runChecks(makeArtifacts(), site);
    // Clean artifacts should not trip any single-page check.
    expect(results).toEqual([]);
  });

  it('skips disabled checks', () => {
    const overrides = { disabledCheckIds: new Set(['meta.title.missing']) };
    const results = runChecks(makeArtifacts({ title: null }), site, overrides);
    expect(results.some((r) => r.ruleId === 'meta.title.missing')).toBe(false);
  });

  it('applies severity overrides', () => {
    const overrides = {
      severityByCheckId: new Map([['meta.title.missing', IssueSeverity.Low]]),
    };
    const results = runChecks(makeArtifacts({ title: null }), site, overrides);
    const titleResult = results.find((r) => r.ruleId === 'meta.title.missing');
    expect(titleResult?.severity).toBe(IssueSeverity.Low);
  });
});
