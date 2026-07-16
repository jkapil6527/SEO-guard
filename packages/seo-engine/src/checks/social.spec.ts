import { getCheck } from '../checks';
import { makeArtifacts, makeSite } from '../fixtures/context';
import type { CheckDefinition } from '../types';

const site = makeSite();

function check(id: string): CheckDefinition {
  const found = getCheck(id);
  if (found === undefined) {
    throw new Error(`missing check ${id}`);
  }
  return found;
}

function statuses(def: CheckDefinition, artifacts = makeArtifacts()): string[] {
  return def.run(artifacts, site).map((r) => r.status);
}

describe('social checks', () => {
  it('og.missing_required fails when a required tag is absent', () => {
    const art = makeArtifacts({ ogTags: { 'og:title': 'T', 'og:type': 'website' } });
    expect(statuses(check('social.og.missing_required'), art)).toContain('fail');
  });

  it('og.missing_required fails when no og tags exist', () => {
    expect(statuses(check('social.og.missing_required'), makeArtifacts({ ogTags: {} }))).toContain(
      'fail',
    );
  });

  it('og.missing_required passes with all required tags', () => {
    expect(statuses(check('social.og.missing_required'))).toContain('pass');
  });

  it('twitter.missing_card', () => {
    expect(
      statuses(check('social.twitter.missing_card'), makeArtifacts({ twitterTags: {} })),
    ).toContain('warning');
    expect(statuses(check('social.twitter.missing_card'))).toContain('pass');
  });
});
