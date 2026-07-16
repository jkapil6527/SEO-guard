"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.md5Hex = md5Hex;
exports.normalizedHash = normalizedHash;
exports.resolveUrl = resolveUrl;
exports.registrableDomain = registrableDomain;
exports.urlRegistrableDomain = urlRegistrableDomain;
exports.robotsTokens = robotsTokens;
exports.isValidBcp47 = isValidBcp47;
/**
 * Internal, pure helpers for the engine. Not part of the public contract.
 */
const node_crypto_1 = require("node:crypto");
const node_net_1 = __importDefault(require("node:net"));
/** md5 hex digest of a UTF-8 string. */
function md5Hex(value) {
    return (0, node_crypto_1.createHash)('md5').update(value, 'utf8').digest('hex');
}
/**
 * Hash of a user-facing value normalized for duplicate detection: trimmed and
 * lowercased. Returns null when the value is absent or empty after trimming.
 */
function normalizedHash(value) {
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
function resolveUrl(raw, base) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return null;
    }
    let url;
    try {
        url = new URL(trimmed, base);
    }
    catch {
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
function registrableDomain(host) {
    let clean = host.trim().toLowerCase();
    if (clean.endsWith('.')) {
        clean = clean.slice(0, -1);
    }
    const bare = clean.startsWith('[') && clean.endsWith(']') ? clean.slice(1, -1) : clean;
    if (node_net_1.default.isIP(bare) !== 0) {
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
function urlRegistrableDomain(url) {
    try {
        return registrableDomain(new URL(url).host);
    }
    catch {
        return null;
    }
}
/** Splits a robots/X-Robots directive string into normalized lowercase tokens. */
function robotsTokens(raw) {
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
function isValidBcp47(tag) {
    return /^[a-z]{2,8}(-[a-z0-9]{2,8})*$/i.test(tag.trim());
}
//# sourceMappingURL=util.js.map