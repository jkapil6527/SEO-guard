import { diffPageSchema } from './diff';
import { validatePageSchema } from './engine';
import { SCHEMA_ENGINE_VERSION } from './version';

const CTX = { url: 'https://x.test/', finalUrl: 'https://x.test/', headers: {} };

describe('validatePageSchema', () => {
  it('reports coverage, validations, rich results and summaries together', () => {
    const html = `
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Article',
            headline: 'A',
            image: 'https://x.test/i.png',
            datePublished: '2026-07-09',
            author: { '@type': 'Person', name: 'x' },
            publisher: { '@type': 'Organization', name: 'p' },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://x.test/' },
            ],
          },
        ],
      })}</script>`;
    const result = validatePageSchema(html, CTX);
    expect(result.coverage.hasSchema).toBe(true);
    expect(result.coverage.entityCount).toBe(2);
    expect(result.coverage.typeCounts.Article).toBe(1);
    expect(result.coverage.richEligibleCount).toBeGreaterThanOrEqual(1);
    expect(result.summaries).toHaveLength(2);
    expect(result.summaries[0]!.entityHash).toBeTruthy();
  });

  it('reports no schema for a page without structured data', () => {
    const result = validatePageSchema('<html><body><p>nothing</p></body></html>', CTX);
    expect(result.coverage.hasSchema).toBe(false);
    expect(result.coverage.entityCount).toBe(0);
  });

  it('detects duplicate schema on the page', () => {
    const block = JSON.stringify({ '@type': 'Organization', name: 'Acme', url: 'https://x.test' });
    const html = `<script type="application/ld+json">${block}</script><script type="application/ld+json">${block}</script>`;
    const result = validatePageSchema(html, CTX);
    expect(result.pageResults.some((r) => r.checkId === 'schema.page.duplicate')).toBe(true);
  });

  it('counts invalid JSON in coverage', () => {
    const result = validatePageSchema(`<script type="application/ld+json">{bad</script>`, CTX);
    expect(result.coverage.invalidJsonCount).toBe(1);
  });
});

describe('diffPageSchema', () => {
  const base = validatePageSchema(
    `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Article',
      '@id': 'https://x.test/a#article',
      headline: 'Old',
      author: { '@type': 'Person', name: 'Jane' },
      image: 'https://x.test/i.png',
      datePublished: '2026-07-01',
    })}</script>`,
    CTX,
  ).summaries;

  it('detects a removed property (author) as High severity', () => {
    const head = validatePageSchema(
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Article',
        '@id': 'https://x.test/a#article',
        headline: 'Old',
        image: 'https://x.test/i.png',
        datePublished: '2026-07-01',
      })}</script>`,
      CTX,
    ).summaries;
    const changes = diffPageSchema(base, head);
    const removed = changes.find((c) => c.type === 'property_removed' && c.property === 'author');
    expect(removed).toBeDefined();
    expect(removed!.severity).toBe('high');
  });

  it('detects a changed property value', () => {
    const head = validatePageSchema(
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Article',
        '@id': 'https://x.test/a#article',
        headline: 'New Title',
        author: { '@type': 'Person', name: 'Jane' },
        image: 'https://x.test/i.png',
        datePublished: '2026-07-01',
      })}</script>`,
      CTX,
    ).summaries;
    const changes = diffPageSchema(base, head);
    expect(
      changes.some((c) => c.type === 'property_value_changed' && c.property === 'headline'),
    ).toBe(true);
  });

  it('detects added and removed schemas', () => {
    const added = diffPageSchema(
      [],
      validatePageSchema(
        `<script type="application/ld+json">{"@type":"Organization","name":"x"}</script>`,
        CTX,
      ).summaries,
    );
    expect(added.some((c) => c.type === 'schema_added')).toBe(true);

    const removed = diffPageSchema(base, []);
    expect(removed.some((c) => c.type === 'schema_removed')).toBe(true);
  });

  it('detects rich-result eligibility change', () => {
    const eligible = validatePageSchema(
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Event',
        '@id': 'https://x.test/e',
        name: 'E',
        startDate: '2026-08-01',
        location: { '@type': 'Place', name: 'Hall', address: 'x' },
      })}</script>`,
      CTX,
    ).summaries;
    const ineligible = validatePageSchema(
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Event',
        '@id': 'https://x.test/e',
        name: 'E',
        location: { '@type': 'Place', name: 'Hall', address: 'x' },
      })}</script>`,
      CTX,
    ).summaries;
    const changes = diffPageSchema(eligible, ineligible);
    expect(changes.some((c) => c.type === 'rich_result_changed' && c.property === 'Event')).toBe(
      true,
    );
  });
});

describe('version', () => {
  it('exports a schema engine version', () => {
    expect(SCHEMA_ENGINE_VERSION).toBe('1.0.0');
  });
});
