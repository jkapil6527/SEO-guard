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

describe('technical checks', () => {
  it('https.not_secure', () => {
    expect(
      statuses(
        check('technical.https.not_secure'),
        makeArtifacts({ https: false, finalUrl: 'http://example.com/' }),
      ),
    ).toContain('fail');
    expect(statuses(check('technical.https.not_secure'))).toContain('pass');
  });

  it('https.mixed_content', () => {
    expect(
      statuses(
        check('technical.https.mixed_content'),
        makeArtifacts({ mixedContentUrls: ['http://a/x.png'] }),
      ),
    ).toContain('fail');
    expect(statuses(check('technical.https.mixed_content'))).toContain('pass');
  });

  it('status.4xx', () => {
    expect(statuses(check('technical.status.4xx'), makeArtifacts({ httpStatus: 404 }))).toContain(
      'fail',
    );
    expect(statuses(check('technical.status.4xx'))).toContain('pass');
  });

  it('status.5xx', () => {
    expect(statuses(check('technical.status.5xx'), makeArtifacts({ httpStatus: 503 }))).toContain(
      'fail',
    );
    expect(statuses(check('technical.status.5xx'))).toContain('pass');
  });

  it('indexability.conflict', () => {
    const conflict = makeArtifacts({
      robotsMeta: {
        raw: 'noindex',
        noindex: true,
        nofollow: false,
        headerRaw: null,
        headerNoindex: false,
      },
      canonicals: ['https://example.com/other'],
    });
    expect(statuses(check('technical.indexability.conflict'), conflict)).toContain('fail');
    // noindex but self-referencing canonical -> no conflict
    const selfCanon = makeArtifacts({
      robotsMeta: {
        raw: 'noindex',
        noindex: true,
        nofollow: false,
        headerRaw: null,
        headerNoindex: false,
      },
      canonicals: ['https://example.com/'],
    });
    expect(statuses(check('technical.indexability.conflict'), selfCanon)).toContain('pass');
    expect(statuses(check('technical.indexability.conflict'))).toContain('pass');
  });

  it('redirect.present', () => {
    const redirected = makeArtifacts({
      url: 'https://example.com/old',
      finalUrl: 'https://example.com/new',
      redirectChain: [{ url: 'https://example.com/old', status: 301 }],
    });
    expect(statuses(check('technical.redirect.present'), redirected)).toContain('warning');
    expect(statuses(check('technical.redirect.present'))).toContain('pass');
  });
});
