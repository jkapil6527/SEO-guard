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

describe('headings checks', () => {
  it('h1.missing', () => {
    expect(
      statuses(
        check('headings.h1.missing'),
        makeArtifacts({ headings: [{ level: 2, text: 'x' }] }),
      ),
    ).toContain('fail');
    expect(statuses(check('headings.h1.missing'))).toContain('pass');
  });

  it('h1.multiple', () => {
    const art = makeArtifacts({
      headings: [
        { level: 1, text: 'a' },
        { level: 1, text: 'b' },
      ],
    });
    expect(statuses(check('headings.h1.multiple'), art)).toContain('fail');
    expect(statuses(check('headings.h1.multiple'))).toContain('pass');
  });

  it('h1.duplicate_of_title', () => {
    const art = makeArtifacts({
      title: 'Same Text',
      h1Text: 'Same Text',
      headings: [{ level: 1, text: 'Same Text' }],
    });
    expect(statuses(check('headings.h1.duplicate_of_title'), art)).toContain('warning');
    expect(statuses(check('headings.h1.duplicate_of_title'))).toContain('pass');
  });

  it('hierarchy.skipped_level', () => {
    const art = makeArtifacts({
      headings: [
        { level: 1, text: 'a' },
        { level: 3, text: 'b' },
      ],
    });
    expect(statuses(check('headings.hierarchy.skipped_level'), art)).toContain('warning');
    const ok = makeArtifacts({
      headings: [
        { level: 1, text: 'a' },
        { level: 2, text: 'b' },
      ],
    });
    expect(statuses(check('headings.hierarchy.skipped_level'), ok)).toContain('pass');
  });

  it('any.empty', () => {
    const art = makeArtifacts({
      headings: [
        { level: 1, text: 'ok' },
        { level: 2, text: '' },
      ],
    });
    expect(statuses(check('headings.any.empty'), art)).toContain('fail');
    expect(statuses(check('headings.any.empty'))).toContain('pass');
  });
});
