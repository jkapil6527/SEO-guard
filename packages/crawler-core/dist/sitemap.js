"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSitemapTree = fetchSitemapTree;
/**
 * Sitemap fetching and parsing: <urlset> documents, <sitemapindex> recursion
 * and gzip-compressed payloads (.xml.gz). Fetches go through the SafeFetcher
 * so nested sitemap URLs get the full SSRF guard. XML is extracted with a
 * small purpose-built scanner — sitemaps are a rigid format and the frozen
 * dependency set allows no XML library.
 */
const node_zlib_1 = __importDefault(require("node:zlib"));
/** Hard cap for a single decompressed sitemap (the sitemap.org limit). */
const MAX_DECOMPRESSED_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_URLS = 50_000;
const DEFAULT_MAX_SITEMAPS = 50;
const NAMED_ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
};
function decodeEntities(value) {
    return value.replace(/&(amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#\d+);/g, (all, entity) => {
        const named = NAMED_ENTITIES[entity.toLowerCase()];
        if (named !== undefined) {
            return named;
        }
        try {
            const codePoint = entity.toLowerCase().startsWith('#x')
                ? parseInt(entity.slice(2), 16)
                : parseInt(entity.slice(1), 10);
            return String.fromCodePoint(codePoint);
        }
        catch {
            return all;
        }
    });
}
/** Yields the inner content of each `<tag>...</tag>` element. */
function* elementContents(xml, tag) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`, 'gi');
    let match;
    while ((match = re.exec(xml)) !== null) {
        yield match[1] ?? '';
    }
}
/** Trimmed, CDATA-unwrapped, entity-decoded text of the first `<tag>` child. */
function elementText(xml, tag) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`, 'i');
    const match = re.exec(xml);
    if (match === null) {
        return null;
    }
    let value = (match[1] ?? '').trim();
    const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(value);
    if (cdata !== null) {
        value = (cdata[1] ?? '').trim();
    }
    return decodeEntities(value);
}
function isHttpUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    catch {
        return false;
    }
}
/**
 * Fetches a sitemap and recursively expands sitemap-index files.
 *
 * - Gzip payloads are detected by their magic bytes (0x1f 0x8b) and inflated;
 *   this covers `.gz` URLs and gzip content-types, while payloads the fetcher
 *   already decompressed at the transport layer pass through untouched.
 * - Recursion is bounded by `maxSitemaps` (default 50) documents fetched in
 *   total; hitting the bound sets `truncated`.
 * - Collection is bounded by `maxUrls` (default 50000) entries; hitting the
 *   bound sets `truncated`.
 * - Fetch and parse failures of nested sitemaps land in `errors`; the rest of
 *   the tree is still processed. Repeated sitemap and `loc` URLs are visited /
 *   emitted once.
 */
async function fetchSitemapTree(rootUrl, fetcher, opts = {}) {
    const maxUrls = opts.maxUrls ?? DEFAULT_MAX_URLS;
    const maxSitemaps = opts.maxSitemaps ?? DEFAULT_MAX_SITEMAPS;
    const entries = [];
    const errors = [];
    const visitedSitemaps = new Set();
    const seenLocs = new Set();
    let truncated = false;
    const addEntry = (loc, lastmod) => {
        if (seenLocs.has(loc)) {
            return;
        }
        if (entries.length >= maxUrls) {
            truncated = true;
            return;
        }
        seenLocs.add(loc);
        const entry = { url: loc };
        if (lastmod !== null && lastmod !== '') {
            entry.lastmod = lastmod;
        }
        entries.push(entry);
    };
    const walk = async (sitemapUrl) => {
        if (truncated || visitedSitemaps.has(sitemapUrl)) {
            return;
        }
        if (visitedSitemaps.size >= maxSitemaps) {
            truncated = true;
            return;
        }
        visitedSitemaps.add(sitemapUrl);
        const result = await fetcher.fetch(sitemapUrl);
        if (result.error !== undefined) {
            errors.push({ url: sitemapUrl, message: `${result.error.code}: ${result.error.message}` });
            return;
        }
        if (!result.ok || result.body === undefined) {
            errors.push({ url: sitemapUrl, message: `HTTP ${result.status}` });
            return;
        }
        let body = result.body;
        // Gzip *payloads* (as opposed to gzip transfer encoding, which the fetcher
        // already reversed) still start with the gzip magic bytes.
        if (body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b) {
            try {
                body = node_zlib_1.default.gunzipSync(body, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                errors.push({ url: sitemapUrl, message: `gzip decompression failed: ${message}` });
                return;
            }
        }
        const xml = body.toString('utf8');
        if (/<sitemapindex[\s>]/i.test(xml)) {
            for (const block of elementContents(xml, 'sitemap')) {
                if (truncated) {
                    return;
                }
                const loc = elementText(block, 'loc');
                if (loc === null || loc === '' || !isHttpUrl(loc)) {
                    continue;
                }
                await walk(loc);
            }
            return;
        }
        if (/<urlset[\s>]/i.test(xml)) {
            for (const block of elementContents(xml, 'url')) {
                if (truncated) {
                    return;
                }
                const loc = elementText(block, 'loc');
                if (loc === null || loc === '' || !isHttpUrl(loc)) {
                    continue;
                }
                addEntry(loc, elementText(block, 'lastmod'));
            }
            return;
        }
        errors.push({
            url: sitemapUrl,
            message: 'unrecognized sitemap format (no urlset/sitemapindex root)',
        });
    };
    await walk(rootUrl);
    return { entries, errors, truncated, sitemapCount: visitedSitemaps.size };
}
//# sourceMappingURL=sitemap.js.map