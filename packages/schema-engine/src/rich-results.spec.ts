import { extractStructuredData } from './extract';
import { PROFILE_PACK } from './packs/profiles';
import { evaluateRichResults } from './rich-results';
import type { SchemaEntity } from './types';

function entityFrom(jsonLd: object): SchemaEntity {
  const e = extractStructuredData(
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ).entities[0];
  if (!e) throw new Error('no entity');
  return e;
}

describe('evaluateRichResults', () => {
  it('marks a complete Article eligible', () => {
    const verdicts = evaluateRichResults(
      entityFrom({
        '@type': 'Article',
        headline: 'x',
        image: 'https://x.test/i.png',
        datePublished: '2026-07-09',
        dateModified: '2026-07-09',
        author: { '@type': 'Person', name: 'a' },
        publisher: { '@type': 'Organization', name: 'p' },
      }),
      PROFILE_PACK,
    );
    const article = verdicts.find((v) => v.profile === 'Article')!;
    expect(article.eligible).toBe(true);
    expect(article.status).toBe('eligible');
  });

  it('downgrades to eligible_with_warnings when recommended missing', () => {
    const verdicts = evaluateRichResults(
      entityFrom({ '@type': 'Article', headline: 'x' }),
      PROFILE_PACK,
    );
    const article = verdicts.find((v) => v.profile === 'Article')!;
    expect(article.eligible).toBe(true);
    expect(article.status).toBe('eligible_with_warnings');
    expect(article.missingRecommended).toContain('author');
  });

  it('marks ineligible when a required property is missing (Event without startDate)', () => {
    const verdicts = evaluateRichResults(
      entityFrom({
        '@type': 'Event',
        name: 'Concert',
        location: { '@type': 'Place', address: 'x' },
      }),
      PROFILE_PACK,
    );
    const event = verdicts.find((v) => v.profile === 'Event')!;
    expect(event.eligible).toBe(false);
    expect(event.status).toBe('ineligible');
    expect(event.missingRequired).toContain('startDate');
    expect(event.reason).toContain('startDate');
  });

  it('evaluates multiple applicable profiles and respects disabledProfiles', () => {
    const org = entityFrom({ '@type': 'LocalBusiness', name: 'Shop', address: 'x' });
    const all = evaluateRichResults(org, PROFILE_PACK);
    expect(all.map((v) => v.profile).sort()).toEqual(['LocalBusiness', 'Organization']);
    const filtered = evaluateRichResults(org, PROFILE_PACK, {
      disabledProfiles: new Set(['Organization']),
    });
    expect(filtered.map((v) => v.profile)).toEqual(['LocalBusiness']);
  });

  it('returns no verdicts for a type with no applicable profile', () => {
    expect(
      evaluateRichResults(entityFrom({ '@type': 'Thing', name: 'x' }), PROFILE_PACK),
    ).toHaveLength(0);
  });
});
