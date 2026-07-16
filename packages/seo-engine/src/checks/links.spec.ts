import { getCheck } from '../checks';
import { makeArtifacts, makeSite } from '../fixtures/context';
import type { CheckDefinition, LinkItem } from '../types';

function check(id: string): CheckDefinition {
  const found = getCheck(id);
  if (found === undefined) {
    throw new Error(`missing check ${id}`);
  }
  return found;
}

const link = (o: Partial<LinkItem>): LinkItem => ({
  href: 'https://example.com/x',
  text: 'descriptive anchor',
  rel: null,
  internal: true,
  nofollow: false,
  targetBlank: false,
  ...o,
});

describe('links checks', () => {
  describe('internal.broken', () => {
    it('not_applicable without linkStatuses', () => {
      expect(
        check('links.internal.broken')
          .run(makeArtifacts(), makeSite())
          .map((r) => r.status),
      ).toEqual(['not_applicable']);
    });
    it('fails for broken internal link', () => {
      const art = makeArtifacts({
        links: [link({ href: 'https://example.com/dead', internal: true })],
      });
      const linkStatuses = new Map([
        ['https://example.com/dead', { status: 404, ok: false, redirectHops: 0 }],
      ]);
      expect(
        check('links.internal.broken')
          .run(art, makeSite({ linkStatuses }))
          .map((r) => r.status),
      ).toContain('fail');
    });
    it('passes when internal link resolves', () => {
      const art = makeArtifacts({
        links: [link({ href: 'https://example.com/ok', internal: true })],
      });
      const linkStatuses = new Map([
        ['https://example.com/ok', { status: 200, ok: true, redirectHops: 0 }],
      ]);
      expect(
        check('links.internal.broken')
          .run(art, makeSite({ linkStatuses }))
          .map((r) => r.status),
      ).toContain('pass');
    });
  });

  describe('external.broken', () => {
    it('fails for broken external link', () => {
      const art = makeArtifacts({
        links: [link({ href: 'https://other.org/dead', internal: false })],
      });
      const linkStatuses = new Map([
        ['https://other.org/dead', { status: 500, ok: false, redirectHops: 0 }],
      ]);
      expect(
        check('links.external.broken')
          .run(art, makeSite({ linkStatuses }))
          .map((r) => r.status),
      ).toContain('fail');
    });
    it('not_applicable without linkStatuses', () => {
      expect(
        check('links.external.broken')
          .run(makeArtifacts(), makeSite())
          .map((r) => r.status),
      ).toEqual(['not_applicable']);
    });
  });

  describe('redirect.chain_too_long', () => {
    it('fails when hops exceed the limit', () => {
      const art = makeArtifacts({ links: [link({ href: 'https://example.com/redir' })] });
      const linkStatuses = new Map([
        ['https://example.com/redir', { status: 200, ok: true, redirectHops: 4 }],
      ]);
      expect(
        check('links.redirect.chain_too_long')
          .run(art, makeSite({ linkStatuses }))
          .map((r) => r.status),
      ).toContain('fail');
    });
    it('passes within the limit', () => {
      const art = makeArtifacts({ links: [link({ href: 'https://example.com/short' })] });
      const linkStatuses = new Map([
        ['https://example.com/short', { status: 200, ok: true, redirectHops: 1 }],
      ]);
      expect(
        check('links.redirect.chain_too_long')
          .run(art, makeSite({ linkStatuses }))
          .map((r) => r.status),
      ).toContain('pass');
    });
    it('not_applicable without linkStatuses', () => {
      expect(
        check('links.redirect.chain_too_long')
          .run(makeArtifacts(), makeSite())
          .map((r) => r.status),
      ).toEqual(['not_applicable']);
    });
  });

  it('rel.noopener_missing_on_blank', () => {
    const bad = makeArtifacts({ links: [link({ targetBlank: true, rel: null })] });
    expect(
      check('links.rel.noopener_missing_on_blank')
        .run(bad, makeSite())
        .map((r) => r.status),
    ).toContain('warning');
    const good = makeArtifacts({ links: [link({ targetBlank: true, rel: 'noopener' })] });
    expect(
      check('links.rel.noopener_missing_on_blank')
        .run(good, makeSite())
        .map((r) => r.status),
    ).toContain('pass');
  });

  it('anchor.empty_or_generic', () => {
    const generic = makeArtifacts({ links: [link({ text: 'click here' })] });
    expect(
      check('links.anchor.empty_or_generic')
        .run(generic, makeSite())
        .map((r) => r.status),
    ).toContain('warning');
    const empty = makeArtifacts({ links: [link({ text: '' })] });
    expect(
      check('links.anchor.empty_or_generic')
        .run(empty, makeSite())
        .map((r) => r.status),
    ).toContain('warning');
    expect(
      check('links.anchor.empty_or_generic')
        .run(makeArtifacts(), makeSite())
        .map((r) => r.status),
    ).toContain('pass');
  });
});
