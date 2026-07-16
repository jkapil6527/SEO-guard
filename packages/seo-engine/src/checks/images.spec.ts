import { getCheck } from '../checks';
import { makeArtifacts, makeSite } from '../fixtures/context';
import type { CheckDefinition, ImageItem } from '../types';

function check(id: string): CheckDefinition {
  const found = getCheck(id);
  if (found === undefined) {
    throw new Error(`missing check ${id}`);
  }
  return found;
}

const img = (o: Partial<ImageItem>): ImageItem => ({
  src: 'https://example.com/x.png',
  alt: 'x',
  width: '1',
  height: '1',
  loading: null,
  ...o,
});

describe('images checks', () => {
  const site = makeSite();

  it('alt.missing', () => {
    const art = makeArtifacts({ images: [img({ alt: null })] });
    expect(
      check('images.alt.missing')
        .run(art, site)
        .map((r) => r.status),
    ).toContain('fail');
    expect(
      check('images.alt.missing')
        .run(makeArtifacts(), site)
        .map((r) => r.status),
    ).toContain('pass');
  });

  it('alt.empty_on_meaningful', () => {
    const art = makeArtifacts({ images: [img({ alt: '' })] });
    expect(
      check('images.alt.empty_on_meaningful')
        .run(art, site)
        .map((r) => r.status),
    ).toContain('warning');
    expect(
      check('images.alt.empty_on_meaningful')
        .run(makeArtifacts(), site)
        .map((r) => r.status),
    ).toContain('pass');
  });

  it('dimensions.missing_width / height', () => {
    const noW = makeArtifacts({ images: [img({ width: null })] });
    const noH = makeArtifacts({ images: [img({ height: null })] });
    expect(
      check('images.dimensions.missing_width')
        .run(noW, site)
        .map((r) => r.status),
    ).toContain('warning');
    expect(
      check('images.dimensions.missing_height')
        .run(noH, site)
        .map((r) => r.status),
    ).toContain('warning');
    expect(
      check('images.dimensions.missing_width')
        .run(makeArtifacts(), site)
        .map((r) => r.status),
    ).toContain('pass');
  });

  describe('src.broken', () => {
    it('is not_applicable without linkStatuses', () => {
      const results = check('images.src.broken').run(makeArtifacts(), makeSite());
      expect(results.map((r) => r.status)).toEqual(['not_applicable']);
    });

    it('fails for a broken source when statuses provided', () => {
      const art = makeArtifacts({ images: [img({ src: 'https://example.com/broken.png' })] });
      const linkStatuses = new Map([
        ['https://example.com/broken.png', { status: 404, ok: false, redirectHops: 0 }],
      ]);
      const results = check('images.src.broken').run(art, makeSite({ linkStatuses }));
      expect(results.map((r) => r.status)).toContain('fail');
    });

    it('passes when the source resolves', () => {
      const art = makeArtifacts({ images: [img({ src: 'https://example.com/ok.png' })] });
      const linkStatuses = new Map([
        ['https://example.com/ok.png', { status: 200, ok: true, redirectHops: 0 }],
      ]);
      const results = check('images.src.broken').run(art, makeSite({ linkStatuses }));
      expect(results.map((r) => r.status)).toContain('pass');
    });
  });
});
