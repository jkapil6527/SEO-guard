/**
 * Internal, pure helpers for the engine. Not part of the public contract.
 */
import { createHash } from 'node:crypto';
import net from 'node:net';

/** md5 hex digest of a UTF-8 string. */
export function md5Hex(value: string): string {
  return createHash('md5').update(value, 'utf8').digest('hex');
}

/**
 * Hash of a user-facing value normalized for duplicate detection: trimmed and
 * lowercased. Returns null when the value is absent or empty after trimming.
 */
export function normalizedHash(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  return md5Hex(normalized);
}

/**
 * Resolves `raw` against `base` into an absolute URL string, dropping the
 * fragment. Returns null for unparseable input or non-http(s) schemes
 * (mailto:, tel:, javascript:, data:, #anchors, ...).
 */
export function resolveUrl(raw: string, base: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  url.hash = '';
  return url.toString();
}

const SECOND_LEVEL_SUFFIX_LABELS = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu']);

/**
 * Best-effort eTLD+1 without a Public Suffix List dependency. Mirrors
 * crawler-core's approach: last two labels, or three when the second-to-last
 * label is a well-known second-level suffix (co.uk, com.au, ...).
 */
export function registrableDomain(host: string): string {
  let clean = host.trim().toLowerCase();
  if (clean.endsWith('.')) {
    clean = clean.slice(0, -1);
  }
  const bare = clean.startsWith('[') && clean.endsWith(']') ? clean.slice(1, -1) : clean;
  if (net.isIP(bare) !== 0) {
    return clean;
  }
  const labels = clean.split('.');
  if (labels.length <= 2) {
    return clean;
  }
  const secondLevel = labels[labels.length - 2];
  const take = secondLevel !== undefined && SECOND_LEVEL_SUFFIX_LABELS.has(secondLevel) ? 3 : 2;
  return labels.slice(-take).join('.');
}

/** Registrable domain of a URL string, or null when the host is unavailable. */
export function urlRegistrableDomain(url: string): string | null {
  try {
    return registrableDomain(new URL(url).host);
  } catch {
    return null;
  }
}

/** Splits a robots/X-Robots directive string into normalized lowercase tokens. */
export function robotsTokens(raw: string | null): string[] {
  if (raw === null) {
    return [];
  }
  return raw
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

/**
 * Loose BCP-47 language tag validation. Accepts primary subtag (2-3 or 4-8
 * alpha) followed by hyphen-delimited alphanumeric subtags (2-8 chars each).
 * Rejects underscores ("en_US") and non-tag words ("english").
 */
export function isValidBcp47(tag: string): boolean {
  return /^[a-z]{2,8}(-[a-z0-9]{2,8})*$/i.test(tag.trim());
}
