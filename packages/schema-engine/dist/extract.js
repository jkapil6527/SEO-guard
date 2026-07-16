"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports._internal = void 0;
exports.extractStructuredData = extractStructuredData;
const cheerio = __importStar(require("cheerio"));
const util_1 = require("./util");
/**
 * Extracts all structured data from an HTML document across JSON-LD, Microdata
 * and RDFa, normalizing every instance into a SchemaEntity graph. Pure and
 * tolerant: malformed blocks are recorded in `parseErrors`, never thrown.
 */
function extractStructuredData(html) {
    const $ = cheerio.load(html);
    const result = { entities: [], rawBlocks: [], parseErrors: [] };
    const counter = { n: 0 };
    extractJsonLd($, result, counter);
    extractMicrodata($, result, counter);
    extractRdfa($, result, counter);
    return result;
}
// ---------------- JSON-LD ----------------
function extractJsonLd($, result, counter) {
    $('script[type="application/ld+json"]').each((index, el) => {
        const raw = $(el).text().trim();
        const location = `script[type=ld+json]:nth(${index})`;
        if (!raw)
            return;
        const block = { format: 'json-ld', raw, location };
        result.rawBlocks.push(block);
        let parsed;
        try {
            parsed = JSON.parse(stripJsonComments(raw));
        }
        catch (err) {
            result.parseErrors.push({
                format: 'json-ld',
                message: `Invalid JSON-LD: ${err.message}`,
                raw,
                location,
            });
            return;
        }
        for (const root of rootNodes(parsed)) {
            const entity = normalizeJsonLdEntity(root, block, counter);
            if (entity)
                result.entities.push(entity);
        }
    });
}
/** JSON-LD trailing commas are common; strip them defensively before parsing. */
function stripJsonComments(raw) {
    return raw.replace(/,\s*([}\]])/g, '$1').replace(/^\uFEFF/, '');
}
function rootNodes(parsed) {
    if (Array.isArray(parsed)) {
        return parsed.flatMap(rootNodes);
    }
    if (parsed && typeof parsed === 'object') {
        const obj = parsed;
        if (Array.isArray(obj['@graph'])) {
            return obj['@graph'].flatMap(rootNodes);
        }
        return [obj];
    }
    return [];
}
function normalizeJsonLdEntity(node, block, counter) {
    const types = toTypes(node['@type']);
    const properties = {};
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('@'))
            continue;
        const normalized = normalizeJsonLdValue(value, block, counter);
        if (normalized !== undefined)
            properties[(0, util_1.shortProperty)(key)] = normalized;
    }
    const idRaw = typeof node['@id'] === 'string' ? node['@id'] : null;
    return buildEntity(types, properties, 'json-ld', block, idRaw, counter);
}
function normalizeJsonLdValue(value, block, counter) {
    if (value === null || value === undefined)
        return undefined;
    if (Array.isArray(value)) {
        const arr = value
            .map((v) => normalizeJsonLdValue(v, block, counter))
            .filter((v) => v !== undefined);
        return arr.length === 1 ? arr[0] : arr;
    }
    if (typeof value === 'object') {
        const obj = value;
        // i18n literal: {"@value": "...", "@language": "en"}
        if ('@value' in obj)
            return obj['@value'];
        // Pure reference: {"@id": "..."} with no type/other props.
        const keys = Object.keys(obj).filter((k) => k !== '@id');
        if ('@id' in obj && keys.length === 0)
            return { ref: obj['@id'] };
        const nested = normalizeJsonLdEntity(obj, block, counter);
        return nested ?? undefined;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return undefined;
}
// ---------------- Microdata ----------------
function extractMicrodata($, result, counter) {
    // Top-level items: itemscope elements that are not themselves an itemprop value.
    $('[itemscope]').each((_i, el) => {
        const $el = $(el);
        if ($el.attr('itemprop') !== undefined)
            return; // nested; handled by its parent
        const entity = normalizeMicrodataItem($, $el, counter);
        if (entity) {
            result.rawBlocks.push(entity.source);
            result.entities.push(entity);
        }
    });
}
function normalizeMicrodataItem($, $item, counter) {
    const itemtype = $item.attr('itemtype') ?? '';
    const types = itemtype.split(/\s+/).filter(Boolean).map(util_1.shortType);
    const properties = {};
    for (const propEl of microdataProps($, $item)) {
        const $prop = $(propEl);
        const names = ($prop.attr('itemprop') ?? '').split(/\s+/).filter(Boolean);
        if (names.length === 0)
            continue;
        let value;
        if ($prop.attr('itemscope') !== undefined) {
            const nested = normalizeMicrodataItem($, $prop, counter);
            if (!nested)
                continue;
            value = nested;
        }
        else {
            value = microdataValue($, $prop);
        }
        for (const name of names)
            addProp(properties, (0, util_1.shortProperty)(name), value);
    }
    const idRaw = $item.attr('itemid') ?? null;
    const location = `microdata:${types[0] ?? 'item'}`;
    const source = {
        format: 'microdata',
        raw: $.html($item) ?? '',
        location,
    };
    return buildEntity(types, properties, 'microdata', source, idRaw, counter);
}
/** Direct itemprop descendants of an item, excluding those inside a nested item. */
function microdataProps($, $item) {
    const out = [];
    const walk = (node) => {
        $(node)
            .children()
            .each((_i, child) => {
            const $child = $(child);
            const isProp = $child.attr('itemprop') !== undefined;
            const isScope = $child.attr('itemscope') !== undefined;
            if (isProp)
                out.push(child);
            // Do not descend into a nested item's subtree (its props belong to it),
            // but still collect a prop that is itself a nested scope (handled above).
            if (!isScope)
                walk(child);
        });
    };
    walk($item.get(0));
    return out;
}
function microdataValue($, $el) {
    const tag = $el.get(0)?.tagName?.toLowerCase();
    if (tag === 'meta')
        return $el.attr('content') ?? '';
    if (tag === 'a' || tag === 'area' || tag === 'link')
        return $el.attr('href') ?? '';
    if (tag === 'img' || tag === 'audio' || tag === 'video' || tag === 'source' || tag === 'embed') {
        return $el.attr('src') ?? '';
    }
    if (tag === 'object')
        return $el.attr('data') ?? '';
    if (tag === 'time')
        return $el.attr('datetime') ?? $el.text().trim();
    if (tag === 'data')
        return $el.attr('value') ?? $el.text().trim();
    const content = $el.attr('content');
    if (content !== undefined)
        return content;
    return $el.text().trim();
}
// ---------------- RDFa (schema.org subset) ----------------
function extractRdfa($, result, counter) {
    $('[typeof]').each((_i, el) => {
        const $el = $(el);
        // Skip nested typeof handled by parent property walk.
        if ($el.attr('property') !== undefined && $el.parents('[typeof]').length > 0)
            return;
        if ($el.parents('[typeof]').length > 0)
            return; // only top-level typeof roots
        const entity = normalizeRdfaItem($, $el, counter);
        if (entity) {
            result.rawBlocks.push(entity.source);
            result.entities.push(entity);
        }
    });
}
function normalizeRdfaItem($, $item, counter) {
    const types = ($item.attr('typeof') ?? '').split(/\s+/).filter(Boolean).map(util_1.shortType);
    const properties = {};
    const walk = (node) => {
        $(node)
            .children()
            .each((_i, child) => {
            const $child = $(child);
            const propName = $child.attr('property');
            const isScope = $child.attr('typeof') !== undefined;
            if (propName) {
                for (const name of propName.split(/\s+/).filter(Boolean)) {
                    const value = isScope
                        ? (normalizeRdfaItem($, $child, counter) ?? rdfaValue($, $child))
                        : rdfaValue($, $child);
                    if (value !== undefined && value !== '')
                        addProp(properties, (0, util_1.shortProperty)(name), value);
                }
            }
            if (!isScope)
                walk(child);
        });
    };
    walk($item.get(0));
    const idRaw = $item.attr('resource') ?? $item.attr('about') ?? null;
    const source = {
        format: 'rdfa',
        raw: $.html($item) ?? '',
        location: `rdfa:${types[0] ?? 'item'}`,
    };
    return buildEntity(types, properties, 'rdfa', source, idRaw, counter);
}
function rdfaValue($, $el) {
    const content = $el.attr('content');
    if (content !== undefined)
        return content;
    const tag = $el.get(0)?.tagName?.toLowerCase();
    if (tag === 'a' || tag === 'link' || tag === 'area')
        return $el.attr('href') ?? $el.text().trim();
    if (tag === 'img')
        return $el.attr('src') ?? '';
    if (tag === 'time')
        return $el.attr('datetime') ?? $el.text().trim();
    const resource = $el.attr('resource');
    if (resource !== undefined)
        return resource;
    return $el.text().trim();
}
// ---------------- shared ----------------
function toTypes(raw) {
    if (typeof raw === 'string')
        return [(0, util_1.shortType)(raw)];
    if (Array.isArray(raw))
        return raw.filter((t) => typeof t === 'string').map(util_1.shortType);
    return [];
}
function addProp(properties, key, value) {
    const existing = properties[key];
    if (existing === undefined) {
        properties[key] = value;
    }
    else if (Array.isArray(existing)) {
        existing.push(value);
    }
    else {
        properties[key] = [existing, value];
    }
}
function buildEntity(types, properties, format, source, idRaw, counter) {
    if (types.length === 0 && Object.keys(properties).length === 0)
        return null;
    const primary = types[0] ?? '';
    const identity = idRaw ?? firstString(properties['url']) ?? firstString(properties['name']) ?? null;
    const id = idRaw ?? `_:b${counter.n++}`;
    const entityHash = (0, util_1.stableHash)({ types: [...types].sort(), properties: cleanProps(properties) });
    return { id, type: primary, types, format, properties, identity, entityHash, source };
}
/** Clean property map (ids/source excluded) for stable hashing. */
function cleanProps(properties) {
    const out = {};
    for (const [k, v] of Object.entries(properties))
        out[k] = cleanForHash(v);
    return out;
}
/** A representation of a value used for hashing/diffing: excludes ids and source. */
function cleanForHash(value) {
    if (Array.isArray(value))
        return value.map(cleanForHash);
    if (value && typeof value === 'object') {
        if ('ref' in value)
            return { ref: value.ref };
        const entity = value;
        if ('entityHash' in entity && 'types' in entity) {
            const cleaned = {};
            for (const [k, v] of Object.entries(entity.properties))
                cleaned[k] = cleanForHash(v);
            return { types: [...entity.types].sort(), properties: cleaned };
        }
    }
    return value;
}
function firstString(value) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value)) {
        for (const v of value) {
            const s = firstString(v);
            if (s)
                return s;
        }
    }
    return null;
}
exports._internal = { cleanForHash, rootNodes };
//# sourceMappingURL=extract.js.map