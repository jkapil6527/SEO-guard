import { extractStructuredData } from './extract';

describe('extractStructuredData — JSON-LD', () => {
  it('extracts a simple Article with nested author/publisher', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Hello World',
      datePublished: '2026-07-09',
      author: { '@type': 'Person', name: 'Jane Doe' },
      publisher: {
        '@type': 'Organization',
        name: 'Acme',
        logo: { '@type': 'ImageObject', url: 'https://acme.test/logo.png' },
      },
    })}</script></head><body></body></html>`;
    const { entities, parseErrors } = extractStructuredData(html);
    expect(parseErrors).toHaveLength(0);
    expect(entities).toHaveLength(1);
    const article = entities[0]!;
    expect(article.type).toBe('Article');
    expect(article.format).toBe('json-ld');
    expect(article.properties.headline).toBe('Hello World');
    const author = article.properties.author as {
      type: string;
      properties: Record<string, unknown>;
    };
    expect(author.type).toBe('Person');
    expect(author.properties.name).toBe('Jane Doe');
  });

  it('flattens @graph into multiple top-level entities', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Site', url: 'https://x.test' },
        { '@type': 'Organization', name: 'Org' },
      ],
    })}</script>`;
    const { entities } = extractStructuredData(html);
    expect(entities.map((e) => e.type).sort()).toEqual(['Organization', 'WebSite']);
  });

  it('resolves @type arrays, @value literals and @id references', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': ['Product', 'Vehicle'],
      name: { '@value': 'Car', '@language': 'en' },
      brand: { '@id': 'https://x.test/brand/acme' },
    })}</script>`;
    const [entity] = extractStructuredData(html).entities;
    expect(entity!.types).toEqual(['Product', 'Vehicle']);
    expect(entity!.properties.name).toBe('Car');
    expect(entity!.properties.brand).toEqual({ ref: 'https://x.test/brand/acme' });
  });

  it('records invalid JSON-LD as a parse error without throwing', () => {
    const html = `<script type="application/ld+json">{ not valid json </script>`;
    const { entities, parseErrors } = extractStructuredData(html);
    expect(entities).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]!.format).toBe('json-ld');
  });

  it('tolerates trailing commas', () => {
    const html = `<script type="application/ld+json">{"@type":"Thing","name":"x",}</script>`;
    const { entities, parseErrors } = extractStructuredData(html);
    expect(parseErrors).toHaveLength(0);
    expect(entities[0]!.properties.name).toBe('x');
  });

  it('produces a stable entityHash independent of whitespace/key order', () => {
    const a = extractStructuredData(
      `<script type="application/ld+json">{"@type":"Thing","name":"x","url":"https://x.test"}</script>`,
    ).entities[0]!;
    const b = extractStructuredData(
      `<script type="application/ld+json">\n{\n  "@type": "Thing",\n  "url": "https://x.test",\n  "name": "x"\n}\n</script>`,
    ).entities[0]!;
    expect(a.entityHash).toBe(b.entityHash);
  });
});

describe('extractStructuredData — Microdata', () => {
  it('extracts an item with properties and a nested item', () => {
    const html = `
      <div itemscope itemtype="https://schema.org/Product">
        <span itemprop="name">Widget</span>
        <img itemprop="image" src="https://x.test/w.png" />
        <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <meta itemprop="price" content="9.99" />
          <link itemprop="availability" href="https://schema.org/InStock" />
        </div>
      </div>`;
    const { entities } = extractStructuredData(html);
    expect(entities).toHaveLength(1);
    const product = entities[0]!;
    expect(product.type).toBe('Product');
    expect(product.format).toBe('microdata');
    expect(product.properties.name).toBe('Widget');
    expect(product.properties.image).toBe('https://x.test/w.png');
    const offer = product.properties.offers as {
      type: string;
      properties: Record<string, unknown>;
    };
    expect(offer.type).toBe('Offer');
    expect(offer.properties.price).toBe('9.99');
    expect(offer.properties.availability).toBe('https://schema.org/InStock');
  });
});

describe('extractStructuredData — RDFa', () => {
  it('extracts a typeof item with property values', () => {
    const html = `
      <div vocab="https://schema.org/" typeof="Person">
        <span property="name">Ada</span>
        <a property="url" href="https://ada.test">site</a>
      </div>`;
    const { entities } = extractStructuredData(html);
    expect(entities).toHaveLength(1);
    expect(entities[0]!.type).toBe('Person');
    expect(entities[0]!.format).toBe('rdfa');
    expect(entities[0]!.properties.name).toBe('Ada');
    expect(entities[0]!.properties.url).toBe('https://ada.test');
  });
});
