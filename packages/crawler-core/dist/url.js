"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUrl = normalizeUrl;
exports.urlHash = urlHash;
exports.registrableDomain = registrableDomain;
/**
 * URL normalization and identity helpers. Pure functions, no I/O.
 */
const node_crypto_1 = require("node:crypto");
const node_net_1 = __importDefault(require("node:net"));
const UNRESERVED = /[A-Za-z0-9\-._~]/;
/**
 * Decodes percent-encodings of RFC 3986 unreserved characters and uppercases
 * the hex digits of the encodings that remain (`%7e` -> `~`, `%2f` -> `%2F`).
 */
function normalizePercentEncoding(component) {
    return component.replace(/%([0-9a-fA-F]{2})/g, (_match, hex) => {
        const char = String.fromCharCode(parseInt(hex, 16));
        return UNRESERVED.test(char) ? char : `%${hex.toUpperCase()}`;
    });
}
/**
 * Canonicalizes a URL for identity/dedupe purposes.
 *
 * - Returns `null` for unparseable input or non-http(s) schemes.
 * - Lowercases scheme and host, strips the fragment and default ports (80/443),
 *   resolves dot segments, and decodes unreserved percent-encodings.
 * - Query params are sorted alphabetically by key (stable: duplicate keys keep
 *   their relative value order). Params in `opts.stripParams` are removed;
 *   `opts.stripQuery` drops the query string entirely.
 * - Duplicate slashes in the path are collapsed (`/a//b` -> `/a/b`).
 * - Trailing slashes are preserved as given, except an empty path becomes `/`.
 */
function normalizeUrl(raw, base, opts = {}) {
    let url;
    try {
        url = base === undefined ? new URL(raw) : new URL(raw, base);
    }
    catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
    }
    url.hash = '';
    // WHATWG URL already drops the scheme-default port, but be explicit in case
    // the input carried it in a form the parser preserved.
    if ((url.protocol === 'http:' && url.port === '80') ||
        (url.protocol === 'https:' && url.port === '443')) {
        url.port = '';
    }
    url.pathname = normalizePercentEncoding(url.pathname).replace(/\/{2,}/g, '/');
    if (opts.stripQuery) {
        url.search = '';
    }
    else {
        const params = url.searchParams;
        if (opts.stripParams !== undefined) {
            for (const name of opts.stripParams) {
                params.delete(name);
            }
        }
        params.sort(); // stable sort by key per the URL spec
        if ([...params.keys()].length === 0) {
            url.search = '';
        }
    }
    return url.toString();
}
/** SHA-256 digest of an already-normalized URL string. */
function urlHash(normalizedUrl) {
    return (0, node_crypto_1.createHash)('sha256').update(normalizedUrl, 'utf8').digest();
}
/**
 * Suffixes that commonly appear as the second-to-last label of a public
 * suffix (co.uk, com.au, gov.in, ...). See {@link registrableDomain}.
 */
const SECOND_LEVEL_SUFFIX_LABELS = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu']);
/**
 * Best-effort eTLD+1 without a Public Suffix List dependency.
 *
 * Takes the last two labels of the host, or the last three when the
 * second-to-last label is a well-known second-level suffix label
 * (co/com/net/org/gov/ac/edu) and the host has at least three labels —
 * this covers co.uk, com.au, co.in, gov.in, ac.jp, etc.
 *
 * LIMITATION: this is intentionally approximate. Multi-part public suffixes
 * outside the built-in set (e.g. `pvt.k12.ma.us`, `github.io`-style private
 * suffixes) collapse to the wrong registrable domain. That is acceptable for
 * politeness grouping; do not use this for security decisions.
 */
function registrableDomain(host) {
    let clean = host.trim().toLowerCase();
    if (clean.endsWith('.')) {
        clean = clean.slice(0, -1);
    }
    const bare = clean.startsWith('[') && clean.endsWith(']') ? clean.slice(1, -1) : clean;
    if (node_net_1.default.isIP(bare) !== 0) {
        return clean; // IP literals have no registrable domain
    }
    const labels = clean.split('.');
    if (labels.length <= 2) {
        return clean;
    }
    const secondLevel = labels[labels.length - 2];
    const take = secondLevel !== undefined && SECOND_LEVEL_SUFFIX_LABELS.has(secondLevel) ? 3 : 2;
    return labels.slice(-take).join('.');
}
//# sourceMappingURL=url.js.map