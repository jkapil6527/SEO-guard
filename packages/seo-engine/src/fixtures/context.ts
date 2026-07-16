/** Test-only helpers for constructing PageContext / SiteContext / artifacts. */
import type { PageArtifacts, PageContext, RobotsMeta, SiteContext } from '../types';

export function makeContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    httpStatus: 200,
    headers: {},
    redirectChain: [],
    rendered: false,
    ...overrides,
  };
}

export function makeSite(overrides: Partial<SiteContext> = {}): SiteContext {
  return {
    origin: 'https://example.com',
    pathScope: '/',
    ...overrides,
  };
}

const DEFAULT_ROBOTS: RobotsMeta = {
  raw: null,
  noindex: false,
  nofollow: false,
  headerRaw: null,
  headerNoindex: false,
};

/** A "clean" artifacts object that passes every single-page check. */
export function makeArtifacts(overrides: Partial<PageArtifacts> = {}): PageArtifacts {
  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    httpStatus: 200,
    rendered: false,
    redirectChain: [],
    title: 'A perfectly reasonable page title',
    metaDescription:
      'A perfectly reasonable meta description that comfortably sits within the recommended length window for search snippets.',
    canonicals: ['https://example.com/'],
    robotsMeta: { ...DEFAULT_ROBOTS },
    charset: 'utf-8',
    htmlLang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    favicon: true,
    ogTags: {
      'og:title': 'T',
      'og:type': 'website',
      'og:image': 'https://example.com/i.png',
      'og:url': 'https://example.com/',
    },
    twitterTags: { 'twitter:card': 'summary' },
    hreflang: [],
    headings: [{ level: 1, text: 'Main heading distinct from title' }],
    images: [
      { src: 'https://example.com/a.png', alt: 'A', width: '10', height: '10', loading: 'lazy' },
    ],
    links: [
      {
        href: 'https://example.com/about',
        text: 'About us',
        rel: null,
        internal: true,
        nofollow: false,
        targetBlank: false,
      },
    ],
    wordCount: 500,
    https: true,
    mixedContentUrls: [],
    etag: null,
    lastModified: null,
    contentType: 'text/html',
    titleHash: 'hash',
    descriptionHash: 'hash',
    h1Hash: 'hash',
    h1Text: 'Main heading distinct from title',
    ...overrides,
  };
}
