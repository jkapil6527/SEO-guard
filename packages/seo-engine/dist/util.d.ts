/** md5 hex digest of a UTF-8 string. */
export declare function md5Hex(value: string): string;
/**
 * Hash of a user-facing value normalized for duplicate detection: trimmed and
 * lowercased. Returns null when the value is absent or empty after trimming.
 */
export declare function normalizedHash(value: string | null | undefined): string | null;
/**
 * Resolves `raw` against `base` into an absolute URL string, dropping the
 * fragment. Returns null for unparseable input or non-http(s) schemes
 * (mailto:, tel:, javascript:, data:, #anchors, ...).
 */
export declare function resolveUrl(raw: string, base: string): string | null;
/**
 * Best-effort eTLD+1 without a Public Suffix List dependency. Mirrors
 * crawler-core's approach: last two labels, or three when the second-to-last
 * label is a well-known second-level suffix (co.uk, com.au, ...).
 */
export declare function registrableDomain(host: string): string;
/** Registrable domain of a URL string, or null when the host is unavailable. */
export declare function urlRegistrableDomain(url: string): string | null;
/** Splits a robots/X-Robots directive string into normalized lowercase tokens. */
export declare function robotsTokens(raw: string | null): string[];
/**
 * Loose BCP-47 language tag validation. Accepts primary subtag (2-3 or 4-8
 * alpha) followed by hyphen-delimited alphanumeric subtags (2-8 chars each).
 * Rejects underscores ("en_US") and non-tag words ("english").
 */
export declare function isValidBcp47(tag: string): boolean;
