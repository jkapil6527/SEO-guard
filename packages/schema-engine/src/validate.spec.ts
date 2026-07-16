import { extractStructuredData } from './extract';
import { PROFILE_PACK } from './packs/profiles';
import { VOCAB_PACK } from './packs/vocab';
import { validateEntity } from './validate';
import type { SchemaEntity } from './types';

function entityFrom(jsonLd: object): SchemaEntity {
  const html = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  const e = extractStructuredData(html).entities[0];
  if (!e) throw new Error('no entity extracted');
  return e;
}

describe('validateEntity', () => {
  it('passes a complete Article and reports no missing required', () => {
    const v = validateEntity(
      entityFrom({
        '@type': 'Article',
        headline: 'Complete',
        image: 'https://x.test/i.png',
        datePublished: '2026-07-09',
        dateModified: '2026-07-09',
        author: { '@type': 'Person', name: 'A' },
        publisher: { '@type': 'Organization', name: 'P' },
      }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    expect(v.missingRequired).toEqual([]);
    expect(v.status).toBe('valid');
  });

  it('flags a missing required property (Article without headline)', () => {
    const v = validateEntity(
      entityFrom({ '@type': 'Article', image: 'https://x.test/i.png' }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    expect(v.missingRequired).toContain('headline');
    expect(v.status).toBe('errors');
    expect(v.results.some((r) => r.checkId === 'schema.article.required.headline')).toBe(true);
  });

  it('flags recommended properties as warnings, not errors', () => {
    const v = validateEntity(
      entityFrom({ '@type': 'Article', headline: 'Has headline only' }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    expect(v.missingRequired).toEqual([]);
    expect(v.missingRecommended).toContain('author');
    expect(v.status).toBe('warnings');
  });

  it('detects invalid value types (bad date, non-URL)', () => {
    const v = validateEntity(
      entityFrom({
        '@type': 'Article',
        headline: 'x',
        datePublished: 'last tuesday',
        image: 'not-a-url',
      }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    expect(v.results.some((r) => r.checkId === 'schema.article.type.datePublished')).toBe(true);
    expect(v.results.some((r) => r.property === 'image' && r.status === 'fail')).toBe(true);
  });

  it('validates enumeration membership for Offer.availability', () => {
    const bad = validateEntity(
      entityFrom({
        '@type': 'Offer',
        price: '9.99',
        priceCurrency: 'USD',
        availability: 'MaybeInStock',
      }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    expect(bad.results.some((r) => r.property === 'availability' && r.status === 'fail')).toBe(
      true,
    );

    const good = validateEntity(
      entityFrom({ '@type': 'Offer', availability: 'https://schema.org/InStock' }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    expect(good.results.some((r) => r.property === 'availability' && r.status === 'fail')).toBe(
      false,
    );
  });

  it('warns on unknown properties and unknown types', () => {
    const unknownProp = validateEntity(
      entityFrom({ '@type': 'Person', notARealProp: 'x' }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    expect(unknownProp.invalidProperties).toContain('notARealProp');

    const unknownType = validateEntity(
      entityFrom({ '@type': 'Flibbertigibbet', name: 'x' }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    expect(unknownType.results.some((r) => r.checkId === 'schema.unknown_type')).toBe(true);
    expect(unknownType.confidence).toBeLessThan(1);
  });

  it('validates nested entities and surfaces their issues on the parent', () => {
    const v = validateEntity(
      entityFrom({
        '@type': 'Product',
        name: 'W',
        image: 'https://x.test/w.png',
        offers: { '@type': 'Offer', price: '10', availability: 'BadEnum' },
      }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    expect(v.results.some((r) => r.entityType === 'Offer' && r.property === 'availability')).toBe(
      true,
    );
  });

  it('inherits properties from parent types (NewsArticle → Article → CreativeWork)', () => {
    const v = validateEntity(
      entityFrom({
        '@type': 'NewsArticle',
        headline: 'N',
        datePublished: '2026-07-09',
        author: 'x',
      }),
      VOCAB_PACK,
      PROFILE_PACK,
    );
    // datePublished is defined on CreativeWork; must not be flagged invalid.
    expect(v.invalidProperties).not.toContain('datePublished');
  });
});
