/**
 * Pure HTML → PageArtifacts extraction. Uses cheerio; performs no I/O and is
 * safe to run on untrusted / malformed markup.
 */
import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type {
  HeadingItem,
  ImageItem,
  LinkItem,
  PageArtifacts,
  PageContext,
  RobotsMeta,
} from './types';
import { normalizedHash, resolveUrl, robotsTokens, urlRegistrableDomain } from './util';

/** Returns a case-insensitive header value, or null. */
function header(headers: Record<string, string>, name: string): string | null {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return null;
}

function extractTitle($: CheerioAPI): string | null {
  const el = $('head title').first().length > 0 ? $('head title').first() : $('title').first();
  if (el.length === 0) {
    return null;
  }
  return el.text().trim();
}

function extractMetaByName($: CheerioAPI, name: string): string | null {
  const el = $(`meta[name="${name}" i]`).first();
  if (el.length === 0) {
    return null;
  }
  const content = el.attr('content');
  return content === undefined ? null : content.trim();
}

function extractRobots($: CheerioAPI, headers: Record<string, string>): RobotsMeta {
  const raw = extractMetaByName($, 'robots');
  const metaTokens = robotsTokens(raw);
  const headerRaw = header(headers, 'x-robots-tag');
  const headerTokens = robotsTokens(headerRaw);
  return {
    raw,
    noindex: metaTokens.includes('noindex') || metaTokens.includes('none'),
    nofollow: metaTokens.includes('nofollow') || metaTokens.includes('none'),
    headerRaw,
    headerNoindex: headerTokens.includes('noindex') || headerTokens.includes('none'),
  };
}

function extractCharset($: CheerioAPI): string | null {
  const direct = $('meta[charset]').first().attr('charset');
  if (direct !== undefined && direct.trim().length > 0) {
    return direct.trim().toLowerCase();
  }
  const httpEquiv = $('meta[http-equiv="content-type" i]').first().attr('content');
  if (httpEquiv !== undefined) {
    const match = /charset\s*=\s*([^;]+)/i.exec(httpEquiv);
    if (match && match[1] !== undefined) {
      return match[1].trim().toLowerCase();
    }
  }
  return null;
}

function extractCanonicals($: CheerioAPI, base: string): string[] {
  const out: string[] = [];
  $('link[rel~="canonical" i]').each((_i, el) => {
    const href = $(el).attr('href');
    if (href === undefined) {
      return;
    }
    const resolved = resolveUrl(href, base);
    if (resolved !== null) {
      out.push(resolved);
    }
  });
  return out;
}

function extractHreflang($: CheerioAPI, base: string): Array<{ lang: string; href: string }> {
  const out: Array<{ lang: string; href: string }> = [];
  $('link[rel~="alternate" i][hreflang]').each((_i, el) => {
    const lang = $(el).attr('hreflang');
    const href = $(el).attr('href');
    if (lang === undefined || href === undefined) {
      return;
    }
    const resolved = resolveUrl(href, base);
    out.push({ lang: lang.trim(), href: resolved ?? href.trim() });
  });
  return out;
}

/** Max characters of source HTML kept per element — enough to identify it, not to bloat the snapshot. */
const SNIPPET_LIMIT = 300;

/**
 * A CSS path that uniquely locates this element in the document, e.g.
 * `main > article > h2:nth-of-type(3)`. Without it an issue can only say "an h2
 * is empty"; with it, the report can say exactly *which* one.
 */
function selectorOf($: CheerioAPI, el: AnyNode): string {
  const parts: string[] = [];
  let current: AnyNode | null = el;
  let depth = 0;

  while (current && depth < 6) {
    const node = current as Element;
    const tag = (node.tagName ?? '').toLowerCase();
    if (!tag || tag === 'html') break;

    const $node = $(node);
    const id = $node.attr('id');
    if (id) {
      // An id is unique — stop climbing, nothing above it adds information.
      parts.unshift(`#${id}`);
      break;
    }

    const sameTagSiblings = $node.parent().children(tag);
    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.index(node as never) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
    } else {
      parts.unshift(tag);
    }

    current = $node.parent().get(0) ?? null;
    depth += 1;
  }
  return parts.join(' > ');
}

/** The element's own source HTML, truncated — "show me the markup that's wrong". */
function snippetOf($: CheerioAPI, el: AnyNode): string {
  const html = $.html(el as never) ?? '';
  const collapsed = html.replace(/\s+/g, ' ').trim();
  return collapsed.length > SNIPPET_LIMIT
    ? `${collapsed.slice(0, SNIPPET_LIMIT)}…`
    : collapsed;
}

function extractHeadings($: CheerioAPI): HeadingItem[] {
  const out: HeadingItem[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_i, el) => {
    const tag = (el.tagName ?? '').toLowerCase();
    const level = Number.parseInt(tag.slice(1), 10);
    if (!Number.isFinite(level)) {
      return;
    }
    out.push({
      level,
      text: $(el).text().trim(),
      selector: selectorOf($, el),
      snippet: snippetOf($, el),
    });
  });
  return out;
}

/**
 * Attributes that carry a lazy-loaded image URL when `src` is absent, in
 * priority order. `data-gsll-src` is BikeDekho's lazy loader; the rest are the
 * common conventions (lazysizes, WordPress, jQuery Lazy, etc.).
 */
const LAZY_SRC_ATTRS = [
  'data-gsll-src',
  'data-src',
  'data-lazy-src',
  'data-lazy',
  'data-original',
  'data-echo',
] as const;

/** First candidate URL from a `srcset`-style value (`"a.jpg 1x, b.jpg 2x"`). */
function firstFromSrcset(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const first = value.split(',')[0]?.trim().split(/\s+/)[0];
  return first !== undefined && first.length > 0 ? first : undefined;
}

/**
 * The URL an <img> will actually request. Prefers a real `src`; when that is
 * missing or empty, falls back to lazy-load attributes so a lazy image is
 * validated against its true target instead of being reported as broken for
 * lacking a `src`.
 */
function effectiveImageSrc($el: ReturnType<CheerioAPI>): {
  raw: string | undefined;
  lazy: boolean;
} {
  const src = $el.attr('src');
  if (src !== undefined && src.trim().length > 0) {
    return { raw: src, lazy: false };
  }
  for (const attr of LAZY_SRC_ATTRS) {
    const value = $el.attr(attr);
    if (value !== undefined && value.trim().length > 0) {
      return { raw: value, lazy: true };
    }
  }
  const fromSrcset =
    firstFromSrcset($el.attr('data-srcset')) ?? firstFromSrcset($el.attr('srcset'));
  if (fromSrcset !== undefined) {
    return { raw: fromSrcset, lazy: true };
  }
  // Nothing usable — preserve the original (possibly empty) src for reporting.
  return { raw: src, lazy: false };
}

function extractImages($: CheerioAPI, base: string): ImageItem[] {
  const out: ImageItem[] = [];
  $('img').each((_i, el) => {
    const $el = $(el);
    const { raw: rawSrc, lazy } = effectiveImageSrc($el);
    const resolved = rawSrc === undefined ? null : resolveUrl(rawSrc, base);
    const altAttr = $el.attr('alt');
    const width = $el.attr('width');
    const height = $el.attr('height');
    const loading = $el.attr('loading');
    out.push({
      src: resolved ?? rawSrc ?? '',
      alt: altAttr === undefined ? null : altAttr,
      width: width === undefined ? null : width,
      height: height === undefined ? null : height,
      loading: loading === undefined ? null : loading,
      lazy,
      selector: selectorOf($, el),
      snippet: snippetOf($, el),
    });
  });
  return out;
}

function extractLinks($: CheerioAPI, base: string, pageDomain: string | null): LinkItem[] {
  const out: LinkItem[] = [];
  $('a[href]').each((_i, el) => {
    const $el = $(el);
    const rawHref = $el.attr('href');
    if (rawHref === undefined) {
      return;
    }
    const href = resolveUrl(rawHref, base);
    if (href === null) {
      return;
    }
    const rel = $el.attr('rel') ?? null;
    const relTokens = rel === null ? [] : rel.toLowerCase().split(/\s+/);
    const linkDomain = urlRegistrableDomain(href);
    out.push({
      href,
      text: $el.text().trim(),
      rel,
      internal: pageDomain !== null && linkDomain !== null && linkDomain === pageDomain,
      nofollow: relTokens.includes('nofollow'),
      targetBlank: ($el.attr('target') ?? '').toLowerCase() === '_blank',
      selector: selectorOf($, el),
      snippet: snippetOf($, el),
    });
  });
  return out;
}

function extractViewport($: CheerioAPI): string | null {
  return extractMetaByName($, 'viewport');
}

function extractFavicon($: CheerioAPI): boolean {
  return $('link[rel~="icon" i]').length > 0;
}

function extractOgTags($: CheerioAPI): Record<string, string> {
  const out: Record<string, string> = {};
  $('meta[property^="og:" i], meta[name^="og:" i]').each((_i, el) => {
    const $el = $(el);
    const key = ($el.attr('property') ?? $el.attr('name'))?.toLowerCase();
    const content = $el.attr('content');
    if (key !== undefined && content !== undefined && !(key in out)) {
      out[key] = content.trim();
    }
  });
  return out;
}

function extractTwitterTags($: CheerioAPI): Record<string, string> {
  const out: Record<string, string> = {};
  $('meta[name^="twitter:" i], meta[property^="twitter:" i]').each((_i, el) => {
    const $el = $(el);
    const key = ($el.attr('name') ?? $el.attr('property'))?.toLowerCase();
    const content = $el.attr('content');
    if (key !== undefined && content !== undefined && !(key in out)) {
      out[key] = content.trim();
    }
  });
  return out;
}

function extractWordCount($: CheerioAPI): number {
  const root = $.root().clone();
  root.find('script, style, noscript, template').remove();
  const body = root.find('body');
  const text = body.length > 0 ? body.text() : root.text();
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  return words.length;
}

const SUBRESOURCE_SELECTORS: Array<{ selector: string; attr: string }> = [
  { selector: 'img[src]', attr: 'src' },
  { selector: 'script[src]', attr: 'src' },
  { selector: 'link[rel~="stylesheet" i][href]', attr: 'href' },
  { selector: 'iframe[src]', attr: 'src' },
  { selector: 'source[src]', attr: 'src' },
  { selector: 'audio[src]', attr: 'src' },
  { selector: 'video[src]', attr: 'src' },
  { selector: 'embed[src]', attr: 'src' },
  { selector: 'object[data]', attr: 'data' },
];

function extractMixedContent($: CheerioAPI, base: string, isHttps: boolean): string[] {
  if (!isHttps) {
    return [];
  }
  const out = new Set<string>();
  for (const { selector, attr } of SUBRESOURCE_SELECTORS) {
    $(selector).each((_i, el) => {
      const value = $(el).attr(attr);
      if (value === undefined) {
        return;
      }
      const resolved = resolveUrl(value, base);
      if (resolved !== null && resolved.startsWith('http://')) {
        out.add(resolved);
      }
    });
  }
  return [...out];
}

export function extractArtifacts(html: string, ctx: PageContext): PageArtifacts {
  const $ = load(html ?? '');
  const base = ctx.finalUrl;
  const pageDomain = urlRegistrableDomain(base);

  let isHttps = false;
  try {
    isHttps = new URL(base).protocol === 'https:';
  } catch {
    isHttps = false;
  }

  const title = extractTitle($);
  const metaDescription = extractMetaByName($, 'description');
  const headings = extractHeadings($);
  const firstH1 = headings.find((h) => h.level === 1);
  const h1Text = firstH1 !== undefined && firstH1.text.length > 0 ? firstH1.text : null;

  const htmlLangAttr = $('html').attr('lang');
  const htmlLang =
    htmlLangAttr !== undefined && htmlLangAttr.trim().length > 0 ? htmlLangAttr.trim() : null;

  return {
    url: ctx.url,
    finalUrl: ctx.finalUrl,
    httpStatus: ctx.httpStatus,
    rendered: ctx.rendered,
    redirectChain: ctx.redirectChain,

    title,
    metaDescription,
    canonicals: extractCanonicals($, base),
    robotsMeta: extractRobots($, ctx.headers),
    charset: extractCharset($),
    htmlLang,
    viewport: extractViewport($),
    favicon: extractFavicon($),
    ogTags: extractOgTags($),
    twitterTags: extractTwitterTags($),
    hreflang: extractHreflang($, base),
    headings,
    images: extractImages($, base),
    links: extractLinks($, base, pageDomain),
    wordCount: extractWordCount($),
    https: isHttps,
    mixedContentUrls: extractMixedContent($, base, isHttps),

    etag: header(ctx.headers, 'etag'),
    lastModified: header(ctx.headers, 'last-modified'),
    contentType: header(ctx.headers, 'content-type'),

    titleHash: normalizedHash(title),
    descriptionHash: normalizedHash(metaDescription),
    h1Hash: normalizedHash(h1Text),
    h1Text,
  };
}
