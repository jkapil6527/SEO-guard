import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * A small deterministic website used by the crawl pipeline test. Two pages
 * share a title (duplicate detection), one page has a missing meta description
 * and an image without alt (SEO issues), and there is one broken internal link.
 */
export interface FixtureSite {
  origin: string;
  port: number;
  close(): Promise<void>;
}

export async function startFixtureSite(): Promise<FixtureSite> {
  const pages: Record<string, { status?: number; body: string }> = {
    '/': {
      body: page({
        title: 'Home — Acme',
        description: 'Acme homepage with a clear description of the company.',
        h1: 'Welcome to Acme',
        body: `
          <p>${'word '.repeat(60)}</p>
          <a href="/about">About</a>
          <a href="/products">Products</a>
          <a href="/missing">Dead link</a>
          <img src="/logo.png" alt="Acme logo" width="200" height="80" />`,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            '@id': 'https://acme.test/#org',
            name: 'Acme',
            url: 'https://acme.test',
            logo: 'https://acme.test/logo.png',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            '@id': 'https://acme.test/#site',
            name: 'Acme',
            url: 'https://acme.test',
          },
        ],
      }),
    },
    '/about': {
      body: page({
        title: 'About — Acme',
        description: 'Learn about the Acme company and its long history of quality.',
        h1: 'About Acme',
        body: `<p>${'word '.repeat(80)}</p><a href="/">Home</a>`,
      }),
    },
    '/products': {
      // Duplicate title with /products-dup, missing meta description, image without alt.
      // Product schema is missing the required "image" → ineligible for Product rich result.
      body: page({
        title: 'Catalog — Acme',
        description: '',
        h1: 'Our Products',
        body: `<p>${'word '.repeat(40)}</p><img src="/p1.png" width="100" /><a href="/">Home</a>`,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            '@id': 'https://acme.test/products#widget',
            name: 'Widget',
            offers: {
              '@type': 'Offer',
              price: '9.99',
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
            },
          },
        ],
      }),
    },
    '/products-dup': {
      body: page({
        title: 'Catalog — Acme',
        description: 'A different description but the same title as the products page.',
        h1: 'Our Products',
        body: `<p>${'word '.repeat(40)}</p><a href="/">Home</a>`,
      }),
    },
    '/missing': { status: 404, body: '<html><body>Not found</body></html>' },
  };

  const server: Server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0] ?? '/';
    const match = pages[url];
    if (!match) {
      res.writeHead(404, { 'content-type': 'text/html' }).end('<html><body>404</body></html>');
      return;
    }
    res
      .writeHead(match.status ?? 200, { 'content-type': 'text/html; charset=utf-8' })
      .end(match.body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function page(opts: {
  title: string;
  description: string;
  h1: string;
  body: string;
  jsonLd?: object[];
}): string {
  const desc = opts.description ? `<meta name="description" content="${opts.description}" />` : '';
  const schema = (opts.jsonLd ?? [])
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n  ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title}</title>
  ${desc}
  <link rel="canonical" href="/" />
  ${schema}
</head>
<body>
  <h1>${opts.h1}</h1>
  ${opts.body}
</body>
</html>`;
}
