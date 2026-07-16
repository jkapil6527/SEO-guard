import { metaChecks } from './meta';
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

describe('meta checks catalog', () => {
  it('exports all expected meta ids', () => {
    const ids = metaChecks.map((c) => c.id);
    expect(ids).toContain('meta.title.missing');
    expect(ids).toContain('meta.robots.noindex');
    expect(ids).toContain('meta.lang.invalid_bcp47');
  });
});

describe('meta.title', () => {
  it('missing: fails when title is null, passes otherwise', () => {
    expect(statuses(check('meta.title.missing'), makeArtifacts({ title: null }))).toContain('fail');
    expect(statuses(check('meta.title.missing'))).toContain('pass');
  });
  it('empty: fails on empty string', () => {
    expect(statuses(check('meta.title.empty'), makeArtifacts({ title: '' }))).toContain('fail');
    expect(statuses(check('meta.title.empty'))).toContain('pass');
  });
  it('too_long: fails over 60 chars', () => {
    expect(
      statuses(check('meta.title.too_long'), makeArtifacts({ title: 'x'.repeat(61) })),
    ).toContain('fail');
    expect(statuses(check('meta.title.too_long'))).toContain('pass');
  });
  it('too_short: warns under 10 chars', () => {
    expect(statuses(check('meta.title.too_short'), makeArtifacts({ title: 'short' }))).toContain(
      'warning',
    );
    expect(statuses(check('meta.title.too_short'))).toContain('pass');
  });
});

describe('meta.description', () => {
  it('missing', () => {
    expect(
      statuses(check('meta.description.missing'), makeArtifacts({ metaDescription: null })),
    ).toContain('fail');
    expect(statuses(check('meta.description.missing'))).toContain('pass');
  });
  it('too_long', () => {
    expect(
      statuses(
        check('meta.description.too_long'),
        makeArtifacts({ metaDescription: 'x'.repeat(161) }),
      ),
    ).toContain('warning');
    expect(statuses(check('meta.description.too_long'))).toContain('pass');
  });
  it('too_short', () => {
    expect(
      statuses(check('meta.description.too_short'), makeArtifacts({ metaDescription: 'tiny' })),
    ).toContain('warning');
    expect(statuses(check('meta.description.too_short'))).toContain('pass');
  });
});

describe('meta.canonical', () => {
  it('missing', () => {
    expect(statuses(check('meta.canonical.missing'), makeArtifacts({ canonicals: [] }))).toContain(
      'fail',
    );
    expect(statuses(check('meta.canonical.missing'))).toContain('pass');
  });
  it('multiple', () => {
    expect(
      statuses(
        check('meta.canonical.multiple'),
        makeArtifacts({ canonicals: ['https://a/', 'https://b/'] }),
      ),
    ).toContain('fail');
    expect(statuses(check('meta.canonical.multiple'))).toContain('pass');
  });
  it('non_https', () => {
    expect(
      statuses(
        check('meta.canonical.non_https'),
        makeArtifacts({ canonicals: ['http://example.com/'] }),
      ),
    ).toContain('fail');
    expect(statuses(check('meta.canonical.non_https'))).toContain('pass');
  });
  it('cross_domain', () => {
    expect(
      statuses(
        check('meta.canonical.cross_domain'),
        makeArtifacts({ canonicals: ['https://other.org/'] }),
      ),
    ).toContain('fail');
    expect(statuses(check('meta.canonical.cross_domain'))).toContain('pass');
  });
});

describe('meta.robots', () => {
  it('noindex via meta', () => {
    const art = makeArtifacts({
      robotsMeta: {
        raw: 'noindex',
        noindex: true,
        nofollow: false,
        headerRaw: null,
        headerNoindex: false,
      },
    });
    expect(statuses(check('meta.robots.noindex'), art)).toContain('fail');
    expect(statuses(check('meta.robots.noindex'))).toContain('pass');
  });
  it('nofollow', () => {
    const art = makeArtifacts({
      robotsMeta: {
        raw: 'nofollow',
        noindex: false,
        nofollow: true,
        headerRaw: null,
        headerNoindex: false,
      },
    });
    expect(statuses(check('meta.robots.nofollow'), art)).toContain('fail');
    expect(statuses(check('meta.robots.nofollow'))).toContain('pass');
  });
  it('conflicting index/noindex', () => {
    const art = makeArtifacts({
      robotsMeta: {
        raw: 'index, noindex',
        noindex: true,
        nofollow: false,
        headerRaw: null,
        headerNoindex: false,
      },
    });
    expect(statuses(check('meta.robots.conflicting'), art)).toContain('fail');
    expect(statuses(check('meta.robots.conflicting'))).toContain('pass');
  });
});

describe('meta.charset / viewport / lang', () => {
  it('charset missing', () => {
    expect(statuses(check('meta.charset.missing'), makeArtifacts({ charset: null }))).toContain(
      'fail',
    );
    expect(statuses(check('meta.charset.missing'))).toContain('pass');
  });
  it('viewport missing', () => {
    expect(statuses(check('meta.viewport.missing'), makeArtifacts({ viewport: null }))).toContain(
      'fail',
    );
    expect(statuses(check('meta.viewport.missing'))).toContain('pass');
  });
  it('viewport not_responsive', () => {
    expect(
      statuses(check('meta.viewport.not_responsive'), makeArtifacts({ viewport: 'width=1024' })),
    ).toContain('fail');
    expect(statuses(check('meta.viewport.not_responsive'))).toContain('pass');
  });
  it('lang missing', () => {
    expect(statuses(check('meta.lang.missing'), makeArtifacts({ htmlLang: null }))).toContain(
      'fail',
    );
    expect(statuses(check('meta.lang.missing'))).toContain('pass');
  });
  it('lang invalid bcp47', () => {
    expect(
      statuses(check('meta.lang.invalid_bcp47'), makeArtifacts({ htmlLang: 'en_US' })),
    ).toContain('fail');
    expect(
      statuses(check('meta.lang.invalid_bcp47'), makeArtifacts({ htmlLang: 'en-US' })),
    ).toContain('pass');
  });
});
