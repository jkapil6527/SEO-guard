"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortType = shortType;
exports.shortProperty = shortProperty;
exports.stableHash = stableHash;
exports.canonicalize = canonicalize;
exports.isIsoDate = isIsoDate;
exports.isHttpUrl = isHttpUrl;
exports.isNumeric = isNumeric;
exports.isInteger = isInteger;
exports.isBooleanish = isBooleanish;
const node_crypto_1 = require("node:crypto");
/** schema.org short name from a full or prefixed type IRI. */
function shortType(type) {
    if (!type)
        return type;
    let t = type.trim();
    t = t.replace(/^https?:\/\/schema\.org\//i, '');
    t = t.replace(/^schema:/i, '');
    // Trailing slash or fragment forms.
    const slash = t.lastIndexOf('/');
    if (slash >= 0)
        t = t.slice(slash + 1);
    const hash = t.lastIndexOf('#');
    if (hash >= 0)
        t = t.slice(hash + 1);
    return t;
}
/** schema.org short property name from a full/prefixed property IRI. */
function shortProperty(prop) {
    return shortType(prop);
}
/** Deterministic sha256 hex of a canonicalized value (stable across runs). */
function stableHash(value) {
    return (0, node_crypto_1.createHash)('sha256').update(canonicalize(value)).digest('hex');
}
/** Canonical JSON: object keys sorted recursively, so equal content hashes equal. */
function canonicalize(value) {
    return JSON.stringify(sortValue(value));
}
function sortValue(value) {
    if (Array.isArray(value))
        return value.map(sortValue);
    if (value && typeof value === 'object') {
        const obj = value;
        const out = {};
        for (const key of Object.keys(obj).sort())
            out[key] = sortValue(obj[key]);
        return out;
    }
    return value;
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
function isIsoDate(value) {
    if (!ISO_DATE.test(value))
        return false;
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
}
function isHttpUrl(value) {
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function isNumeric(value) {
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (typeof value === 'string')
        return value.trim() !== '' && Number.isFinite(Number(value));
    return false;
}
function isInteger(value) {
    if (typeof value === 'number')
        return Number.isInteger(value);
    if (typeof value === 'string')
        return /^-?\d+$/.test(value.trim());
    return false;
}
function isBooleanish(value) {
    if (typeof value === 'boolean')
        return true;
    if (typeof value === 'string')
        return /^(true|false|https?:\/\/schema\.org\/(True|False))$/i.test(value.trim());
    return false;
}
//# sourceMappingURL=util.js.map