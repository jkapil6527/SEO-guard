import type { NormalizeOptions } from './types';
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
export declare function normalizeUrl(raw: string, base?: string, opts?: NormalizeOptions): string | null;
/** SHA-256 digest of an already-normalized URL string. */
export declare function urlHash(normalizedUrl: string): Buffer;
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
export declare function registrableDomain(host: string): string;
