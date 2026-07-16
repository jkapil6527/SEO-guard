import zlib from 'node:zlib';
import { SafeFetcher } from './safe-fetcher';
import { fetchSitemapTree } from './sitemap';
import { startFixtureServer } from './test-support/fixture-server';
import type { FixtureServer } from './test-support/fixture-server';

function urlset(urls: Array<{ loc: string; lastmod?: string }>): string {
  const body = urls
    .map(
      (u) =>
        `<url><loc>${u.loc}</loc>${u.lastmod !== undefined ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

function sitemapindex(locs: string[]): string {
  const body = locs.map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

describe('fetchSitemapTree', () => {
  let server: FixtureServer;
  let fetcher: SafeFetcher;
  const routes = new Map<
    string,
    { status?: number; headers?: Record<string, string>; body: Buffer }
  >();

  const route = (path: string, body: string | Buffer, headers?: Record<string, string>): void => {
    routes.set(path, {
      body: Buffer.isBuffer(body) ? body : Buffer.from(body),
      headers,
    });
  };

  beforeAll(async () => {
    server = await startFixtureServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0] ?? '/';
      const found = routes.get(path);
      if (found === undefined) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(found.status ?? 200, {
        'Content-Type': 'application/xml',
        ...found.headers,
      });
      res.end(found.body);
    });
    fetcher = new SafeFetcher({
      userAgent: 'SEOGuardianBot/1.0',
      allowPrivateTargets: [server.allowTarget],
    });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    routes.clear();
  });

  it('parses a plain urlset with lastmod', async () => {
    route(
      '/sitemap.xml',
      urlset([
        { loc: 'https://example.com/', lastmod: '2026-01-01' },
        { loc: 'https://example.com/about' },
      ]),
    );
    const result = await fetchSitemapTree(server.url('/sitemap.xml'), fetcher, { maxUrls: 100 });
    expect(result.errors).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.entries).toEqual([
      { url: 'https://example.com/', lastmod: '2026-01-01' },
      { url: 'https://example.com/about' },
    ]);
  });

  it('decodes XML entities and CDATA in loc values', async () => {
    route(
      '/sitemap.xml',
      urlset([{ loc: 'https://example.com/search?a=1&amp;b=2' }]).replace(
        '</urlset>',
        '<url><loc><![CDATA[https://example.com/cdata?x=1&y=2]]></loc></url></urlset>',
      ),
    );
    const result = await fetchSitemapTree(server.url('/sitemap.xml'), fetcher, { maxUrls: 100 });
    expect(result.entries.map((e) => e.url)).toEqual([
      'https://example.com/search?a=1&b=2',
      'https://example.com/cdata?x=1&y=2',
    ]);
  });

  it('skips entries whose loc is not an http(s) URL', async () => {
    route(
      '/sitemap.xml',
      urlset([
        { loc: 'https://example.com/good' },
        { loc: 'ftp://example.com/bad' },
        { loc: 'not-a-url' },
      ]),
    );
    const result = await fetchSitemapTree(server.url('/sitemap.xml'), fetcher, { maxUrls: 100 });
    expect(result.entries).toEqual([{ url: 'https://example.com/good' }]);
  });

  it('dedupes repeated loc URLs', async () => {
    route(
      '/sitemap.xml',
      urlset([
        { loc: 'https://example.com/dup' },
        { loc: 'https://example.com/dup' },
        { loc: 'https://example.com/other' },
      ]),
    );
    const result = await fetchSitemapTree(server.url('/sitemap.xml'), fetcher, { maxUrls: 100 });
    expect(result.entries.map((e) => e.url)).toEqual([
      'https://example.com/dup',
      'https://example.com/other',
    ]);
  });

  it('handles gzip-compressed sitemap payloads', async () => {
    route(
      '/sitemap.xml.gz',
      zlib.gzipSync(Buffer.from(urlset([{ loc: 'https://example.com/zipped' }]))),
      { 'Content-Type': 'application/gzip' },
    );
    const result = await fetchSitemapTree(server.url('/sitemap.xml.gz'), fetcher, { maxUrls: 100 });
    expect(result.errors).toEqual([]);
    expect(result.entries).toEqual([{ url: 'https://example.com/zipped' }]);
  });

  it('reports corrupt gzip payloads as errors', async () => {
    route('/broken.xml.gz', Buffer.concat([Buffer.from([0x1f, 0x8b]), Buffer.from('garbage')]), {
      'Content-Type': 'application/gzip',
    });
    const result = await fetchSitemapTree(server.url('/broken.xml.gz'), fetcher, { maxUrls: 100 });
    expect(result.entries).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('gzip');
  });

  it('recurses sitemap index files', async () => {
    route('/index.xml', sitemapindex([server.url('/child-1.xml'), server.url('/child-2.xml.gz')]));
    route('/child-1.xml', urlset([{ loc: 'https://example.com/one' }]));
    route(
      '/child-2.xml.gz',
      zlib.gzipSync(Buffer.from(urlset([{ loc: 'https://example.com/two' }]))),
      { 'Content-Type': 'application/gzip' },
    );
    const result = await fetchSitemapTree(server.url('/index.xml'), fetcher, { maxUrls: 100 });
    expect(result.errors).toEqual([]);
    expect(result.entries.map((e) => e.url)).toEqual([
      'https://example.com/one',
      'https://example.com/two',
    ]);
  });

  it('continues past broken children and records their errors', async () => {
    route('/index.xml', sitemapindex([server.url('/missing.xml'), server.url('/good.xml')]));
    route('/good.xml', urlset([{ loc: 'https://example.com/survives' }]));
    const result = await fetchSitemapTree(server.url('/index.xml'), fetcher, { maxUrls: 100 });
    expect(result.entries).toEqual([{ url: 'https://example.com/survives' }]);
    expect(result.errors).toEqual([{ url: server.url('/missing.xml'), message: 'HTTP 404' }]);
  });

  it('collects a malformed nested sitemap as an error, not a throw', async () => {
    route('/index.xml', sitemapindex([server.url('/garbage.xml'), server.url('/good.xml')]));
    route('/garbage.xml', '<<< this is not a sitemap >>>');
    route('/good.xml', urlset([{ loc: 'https://example.com/ok' }]));
    const result = await fetchSitemapTree(server.url('/index.xml'), fetcher, { maxUrls: 100 });
    expect(result.entries).toEqual([{ url: 'https://example.com/ok' }]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.url).toBe(server.url('/garbage.xml'));
    expect(result.errors[0]?.message).toContain('unrecognized');
  });

  it('truncates at maxUrls and sets the flag', async () => {
    route(
      '/sitemap.xml',
      urlset(Array.from({ length: 10 }, (_, i) => ({ loc: `https://example.com/page-${i}` }))),
    );
    const result = await fetchSitemapTree(server.url('/sitemap.xml'), fetcher, { maxUrls: 4 });
    expect(result.entries).toHaveLength(4);
    expect(result.truncated).toBe(true);
  });

  it('does not mark truncated when entries fit exactly', async () => {
    route('/sitemap.xml', urlset([{ loc: 'https://example.com/only' }]));
    const result = await fetchSitemapTree(server.url('/sitemap.xml'), fetcher, { maxUrls: 1 });
    expect(result.entries).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });

  it('bounds the number of fetched sitemaps with maxSitemaps and sets truncated', async () => {
    route('/level-1.xml', sitemapindex([server.url('/level-2.xml')]));
    route('/level-2.xml', sitemapindex([server.url('/level-3.xml')]));
    route('/level-3.xml', urlset([{ loc: 'https://example.com/deep' }]));

    // Only the index and its first child may be fetched; the leaf is cut off.
    const shallow = await fetchSitemapTree(server.url('/level-1.xml'), fetcher, {
      maxUrls: 100,
      maxSitemaps: 2,
    });
    expect(shallow.entries).toEqual([]);
    expect(shallow.truncated).toBe(true);

    // Enough budget for all three documents.
    const deep = await fetchSitemapTree(server.url('/level-1.xml'), fetcher, {
      maxUrls: 100,
      maxSitemaps: 3,
    });
    expect(deep.entries).toEqual([{ url: 'https://example.com/deep' }]);
    expect(deep.truncated).toBe(false);
  });

  it('visits a repeated/self-referencing sitemap only once', async () => {
    route('/self.xml', sitemapindex([server.url('/self.xml'), server.url('/leaf.xml')]));
    route('/leaf.xml', urlset([{ loc: 'https://example.com/leaf' }]));
    const result = await fetchSitemapTree(server.url('/self.xml'), fetcher, { maxUrls: 100 });
    expect(result.entries).toEqual([{ url: 'https://example.com/leaf' }]);
    expect(result.errors).toEqual([]);
  });

  it('records fetch errors from the SafeFetcher (SSRF guard applies to nested locs)', async () => {
    route('/evil-index.xml', sitemapindex(['http://169.254.169.254/latest/meta-data/']));
    const result = await fetchSitemapTree(server.url('/evil-index.xml'), fetcher, { maxUrls: 100 });
    expect(result.entries).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('SSRF_BLOCKED');
  });

  it('reports unrecognized formats', async () => {
    route('/not-a-sitemap.xml', '<html><body>hello</body></html>');
    const result = await fetchSitemapTree(server.url('/not-a-sitemap.xml'), fetcher, {
      maxUrls: 100,
    });
    expect(result.entries).toEqual([]);
    expect(result.errors[0]?.message).toContain('unrecognized');
  });
});
