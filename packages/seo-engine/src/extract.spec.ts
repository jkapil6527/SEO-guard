import { extractArtifacts } from './extract';
import { makeContext } from './fixtures/context';

const RICH_HTML = `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <title>  Rich Fixture Page  </title>
  <meta name="description" content="  A rich fixture description.  ">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <link rel="canonical" href="/canonical-path">
  <link rel="icon" href="/favicon.ico">
  <link rel="alternate" hreflang="fr" href="https://example.com/fr">
  <meta property="og:title" content="OG Title">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="http://cdn.example.net/style.css">
</head>
<body>
  <h1>Primary Heading</h1>
  <h2>Sub</h2>
  <h4>Skipped</h4>
  <p>Some visible words here in the body content.</p>
  <script>var ignored = "not counted";</script>
  <img src="/img/a.png" alt="Alpha" width="100" height="80" loading="lazy">
  <img src="https://cdn.other.org/b.png">
  <img src="http://insecure.example.net/c.png" alt="">
  <a href="/internal">Internal</a>
  <a href="https://external.example.org/page" rel="nofollow" target="_blank">External</a>
  <a href="mailto:hi@example.com">Mail</a>
</body>
</html>`;

describe('extractArtifacts', () => {
  const ctx = makeContext({
    url: 'https://example.com/page',
    finalUrl: 'https://example.com/page',
    headers: {
      ETag: '"abc"',
      'Last-Modified': 'Wed, 01 Jan 2026 00:00:00 GMT',
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex',
    },
  });
  const a = extractArtifacts(RICH_HTML, ctx);

  it('extracts and trims the title', () => {
    expect(a.title).toBe('Rich Fixture Page');
  });

  it('extracts and trims the meta description', () => {
    expect(a.metaDescription).toBe('A rich fixture description.');
  });

  it('resolves canonical to an absolute URL', () => {
    expect(a.canonicals).toEqual(['https://example.com/canonical-path']);
  });

  it('parses meta robots and X-Robots-Tag header', () => {
    expect(a.robotsMeta.noindex).toBe(true);
    expect(a.robotsMeta.nofollow).toBe(true);
    expect(a.robotsMeta.headerNoindex).toBe(true);
    expect(a.robotsMeta.headerRaw).toBe('noindex');
  });

  it('extracts charset, lang, viewport, favicon', () => {
    expect(a.charset).toBe('utf-8');
    expect(a.htmlLang).toBe('en-US');
    expect(a.viewport).toContain('device-width');
    expect(a.favicon).toBe(true);
  });

  it('extracts og and twitter tags', () => {
    expect(a.ogTags['og:title']).toBe('OG Title');
    expect(a.ogTags['og:type']).toBe('article');
    expect(a.twitterTags['twitter:card']).toBe('summary_large_image');
  });

  it('extracts hreflang with absolute href', () => {
    expect(a.hreflang).toEqual([{ lang: 'fr', href: 'https://example.com/fr' }]);
  });

  it('captures all headings in document order', () => {
    expect(a.headings).toEqual([
      expect.objectContaining({ level: 1, text: 'Primary Heading' }),
      expect.objectContaining({ level: 2, text: 'Sub' }),
      expect.objectContaining({ level: 4, text: 'Skipped' }),
    ]);
  });

  it('locates each element with a CSS selector and a source snippet', () => {
    // The "where" of an issue: without this a report can only say "an h1 is
    // wrong", never which one.
    expect(a.headings[0]?.selector).toBe('body > h1');
    expect(a.headings[0]?.snippet).toBe('<h1>Primary Heading</h1>');
    expect(a.images[0]?.selector).toBe('body > img:nth-of-type(1)');
    expect(a.images[1]?.selector).toBe('body > img:nth-of-type(2)');
    expect(a.links[0]?.selector).toContain('a');
  });

  it('extracts images with absolute src and attributes', () => {
    expect(a.images[0]).toEqual(
      expect.objectContaining({
        src: 'https://example.com/img/a.png',
        alt: 'Alpha',
        width: '100',
        height: '80',
        loading: 'lazy',
      }),
    );
    expect(a.images[1]?.alt).toBeNull();
    expect(a.images[2]?.alt).toBe('');
  });

  it('resolves lazy-loaded images from data-* attributes instead of reporting them srcless', () => {
    const html = `<!DOCTYPE html><html><body>
      <img data-gsll-src="https://cdn.bikedekho.com/pwa/img/itunes.svg?v=1.0" alt="iOS App">
      <img data-src="/img/lazy.png" alt="Lazy">
      <img srcset="/img/small.png 1x, /img/large.png 2x" alt="Srcset">
      <img alt="No source at all">
    </body></html>`;
    const out = extractArtifacts(html, ctx);
    // data-gsll-src becomes the effective, absolute source and is flagged lazy.
    expect(out.images[0]).toEqual(
      expect.objectContaining({
        src: 'https://cdn.bikedekho.com/pwa/img/itunes.svg?v=1.0',
        lazy: true,
      }),
    );
    expect(out.images[1]?.src).toBe('https://example.com/img/lazy.png');
    expect(out.images[1]?.lazy).toBe(true);
    // srcset falls back to the first candidate URL.
    expect(out.images[2]?.src).toBe('https://example.com/img/small.png');
    expect(out.images[2]?.lazy).toBe(true);
    // Genuinely source-less image stays empty (and is skipped downstream).
    expect(out.images[3]?.src).toBe('');
    expect(out.images[3]?.lazy).toBe(false);
  });

  it('classifies links internal vs external and skips non-http', () => {
    // mailto: is skipped; two http links remain.
    expect(a.links).toHaveLength(2);
    const internal = a.links.find((l) => l.href === 'https://example.com/internal');
    const external = a.links.find((l) => l.href === 'https://external.example.org/page');
    expect(internal?.internal).toBe(true);
    expect(external?.internal).toBe(false);
    expect(external?.nofollow).toBe(true);
    expect(external?.targetBlank).toBe(true);
  });

  it('counts visible words excluding script/style', () => {
    // headings (4) + paragraph (8) + link anchors (3) = 15; the script's
    // "not counted" words must be excluded.
    expect(a.wordCount).toBe(15);
  });

  it('detects mixed content on an https page', () => {
    expect(a.mixedContentUrls).toContain('http://cdn.example.net/style.css');
    expect(a.mixedContentUrls).toContain('http://insecure.example.net/c.png');
    expect(a.https).toBe(true);
  });

  it('echoes response headers with lowercased lookup', () => {
    expect(a.etag).toBe('"abc"');
    expect(a.lastModified).toBe('Wed, 01 Jan 2026 00:00:00 GMT');
    expect(a.contentType).toBe('text/html; charset=utf-8');
  });

  it('produces md5 hashes and h1Text', () => {
    expect(a.titleHash).toMatch(/^[0-9a-f]{32}$/);
    expect(a.descriptionHash).toMatch(/^[0-9a-f]{32}$/);
    expect(a.h1Hash).toMatch(/^[0-9a-f]{32}$/);
    expect(a.h1Text).toBe('Primary Heading');
  });

  it('hashes are deterministic and normalized (case/whitespace insensitive)', () => {
    const b = extractArtifacts(
      '<title>  RICH fixture PAGE </title>',
      makeContext({ finalUrl: 'https://example.com/page' }),
    );
    expect(b.titleHash).toBe(a.titleHash);
  });

  it('returns null hashes when values are absent', () => {
    const empty = extractArtifacts('<html><body></body></html>', makeContext());
    expect(empty.title).toBeNull();
    expect(empty.titleHash).toBeNull();
    expect(empty.descriptionHash).toBeNull();
    expect(empty.h1Hash).toBeNull();
    expect(empty.h1Text).toBeNull();
  });

  it('is robust to malformed HTML', () => {
    const malformed = extractArtifacts(
      '<html><head><title>Broken</title><body><h1>Unclosed<img src="x.png"><a href="/y">y',
      makeContext({ finalUrl: 'https://example.com/' }),
    );
    expect(malformed.title).toBe('Broken');
    expect(malformed.headings[0]?.text).toContain('Unclosed');
    expect(malformed.images[0]?.src).toBe('https://example.com/x.png');
    expect(malformed.links[0]?.href).toBe('https://example.com/y');
  });

  it('reports https=false and no mixed content on http pages', () => {
    const httpPage = extractArtifacts(
      '<img src="http://a.com/x.png">',
      makeContext({ finalUrl: 'http://example.com/' }),
    );
    expect(httpPage.https).toBe(false);
    expect(httpPage.mixedContentUrls).toEqual([]);
  });
});
