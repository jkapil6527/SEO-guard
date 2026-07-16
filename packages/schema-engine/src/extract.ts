import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type {
  ExtractionResult,
  RawSchemaBlock,
  SchemaEntity,
  SchemaFormat,
  SchemaValue,
} from './types';
import { shortProperty, shortType, stableHash } from './util';

/**
 * Extracts all structured data from an HTML document across JSON-LD, Microdata
 * and RDFa, normalizing every instance into a SchemaEntity graph. Pure and
 * tolerant: malformed blocks are recorded in `parseErrors`, never thrown.
 */
export function extractStructuredData(html: string): ExtractionResult {
  const $ = cheerio.load(html);
  const result: ExtractionResult = { entities: [], rawBlocks: [], parseErrors: [] };
  const counter = { n: 0 };

  extractJsonLd($, result, counter);
  extractMicrodata($, result, counter);
  extractRdfa($, result, counter);

  return result;
}

// ---------------- JSON-LD ----------------

function extractJsonLd($: CheerioAPI, result: ExtractionResult, counter: { n: number }): void {
  $('script[type="application/ld+json"]').each((index, el) => {
    const raw = $(el).text().trim();
    const location = `script[type=ld+json]:nth(${index})`;
    if (!raw) return;
    const block: RawSchemaBlock = { format: 'json-ld', raw, location };
    result.rawBlocks.push(block);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonComments(raw));
    } catch (err) {
      result.parseErrors.push({
        format: 'json-ld',
        message: `Invalid JSON-LD: ${(err as Error).message}`,
        raw,
        location,
      });
      return;
    }

    for (const root of rootNodes(parsed)) {
      const entity = normalizeJsonLdEntity(root, block, counter);
      if (entity) result.entities.push(entity);
    }
  });
}

/** JSON-LD trailing commas are common; strip them defensively before parsing. */
function stripJsonComments(raw: string): string {
  return raw.replace(/,\s*([}\]])/g, '$1').replace(/^\uFEFF/, '');
}

function rootNodes(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) {
    return parsed.flatMap(rootNodes);
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) {
      return (obj['@graph'] as unknown[]).flatMap(rootNodes);
    }
    return [obj];
  }
  return [];
}

function normalizeJsonLdEntity(
  node: Record<string, unknown>,
  block: RawSchemaBlock,
  counter: { n: number },
): SchemaEntity | null {
  const types = toTypes(node['@type']);
  const properties: Record<string, SchemaValue> = {};

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@')) continue;
    const normalized = normalizeJsonLdValue(value, block, counter);
    if (normalized !== undefined) properties[shortProperty(key)] = normalized;
  }

  const idRaw = typeof node['@id'] === 'string' ? (node['@id'] as string) : null;
  return buildEntity(types, properties, 'json-ld', block, idRaw, counter);
}

function normalizeJsonLdValue(
  value: unknown,
  block: RawSchemaBlock,
  counter: { n: number },
): SchemaValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const arr = value
      .map((v) => normalizeJsonLdValue(v, block, counter))
      .filter((v): v is SchemaValue => v !== undefined);
    return arr.length === 1 ? arr[0] : arr;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // i18n literal: {"@value": "...", "@language": "en"}
    if ('@value' in obj) return obj['@value'] as SchemaValue;
    // Pure reference: {"@id": "..."} with no type/other props.
    const keys = Object.keys(obj).filter((k) => k !== '@id');
    if ('@id' in obj && keys.length === 0) return { ref: obj['@id'] as string };
    const nested = normalizeJsonLdEntity(obj, block, counter);
    return nested ?? undefined;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

// ---------------- Microdata ----------------

function extractMicrodata($: CheerioAPI, result: ExtractionResult, counter: { n: number }): void {
  // Top-level items: itemscope elements that are not themselves an itemprop value.
  $('[itemscope]').each((_i, el) => {
    const $el = $(el);
    if ($el.attr('itemprop') !== undefined) return; // nested; handled by its parent
    const entity = normalizeMicrodataItem($, $el, counter);
    if (entity) {
      result.rawBlocks.push(entity.source);
      result.entities.push(entity);
    }
  });
}

function normalizeMicrodataItem(
  $: CheerioAPI,
  $item: Cheerio<Element>,
  counter: { n: number },
): SchemaEntity | null {
  const itemtype = $item.attr('itemtype') ?? '';
  const types = itemtype.split(/\s+/).filter(Boolean).map(shortType);
  const properties: Record<string, SchemaValue> = {};

  for (const propEl of microdataProps($, $item)) {
    const $prop = $(propEl);
    const names = ($prop.attr('itemprop') ?? '').split(/\s+/).filter(Boolean);
    if (names.length === 0) continue;
    let value: SchemaValue;
    if ($prop.attr('itemscope') !== undefined) {
      const nested = normalizeMicrodataItem($, $prop, counter);
      if (!nested) continue;
      value = nested;
    } else {
      value = microdataValue($, $prop);
    }
    for (const name of names) addProp(properties, shortProperty(name), value);
  }

  const idRaw = $item.attr('itemid') ?? null;
  const location = `microdata:${types[0] ?? 'item'}`;
  const source: RawSchemaBlock = {
    format: 'microdata',
    raw: $.html($item) ?? '',
    location,
  };
  return buildEntity(types, properties, 'microdata', source, idRaw, counter);
}

/** Direct itemprop descendants of an item, excluding those inside a nested item. */
function microdataProps($: CheerioAPI, $item: Cheerio<Element>): Element[] {
  const out: Element[] = [];
  const walk = (node: Element): void => {
    $(node)
      .children()
      .each((_i, child) => {
        const $child = $(child);
        const isProp = $child.attr('itemprop') !== undefined;
        const isScope = $child.attr('itemscope') !== undefined;
        if (isProp) out.push(child);
        // Do not descend into a nested item's subtree (its props belong to it),
        // but still collect a prop that is itself a nested scope (handled above).
        if (!isScope) walk(child);
      });
  };
  walk($item.get(0) as Element);
  return out;
}

function microdataValue($: CheerioAPI, $el: Cheerio<Element>): string {
  const tag = ($el.get(0) as { tagName?: string } | undefined)?.tagName?.toLowerCase();
  if (tag === 'meta') return $el.attr('content') ?? '';
  if (tag === 'a' || tag === 'area' || tag === 'link') return $el.attr('href') ?? '';
  if (tag === 'img' || tag === 'audio' || tag === 'video' || tag === 'source' || tag === 'embed') {
    return $el.attr('src') ?? '';
  }
  if (tag === 'object') return $el.attr('data') ?? '';
  if (tag === 'time') return $el.attr('datetime') ?? $el.text().trim();
  if (tag === 'data') return $el.attr('value') ?? $el.text().trim();
  const content = $el.attr('content');
  if (content !== undefined) return content;
  return $el.text().trim();
}

// ---------------- RDFa (schema.org subset) ----------------

function extractRdfa($: CheerioAPI, result: ExtractionResult, counter: { n: number }): void {
  $('[typeof]').each((_i, el) => {
    const $el = $(el);
    // Skip nested typeof handled by parent property walk.
    if ($el.attr('property') !== undefined && $el.parents('[typeof]').length > 0) return;
    if ($el.parents('[typeof]').length > 0) return; // only top-level typeof roots
    const entity = normalizeRdfaItem($, $el, counter);
    if (entity) {
      result.rawBlocks.push(entity.source);
      result.entities.push(entity);
    }
  });
}

function normalizeRdfaItem(
  $: CheerioAPI,
  $item: Cheerio<Element>,
  counter: { n: number },
): SchemaEntity | null {
  const types = ($item.attr('typeof') ?? '').split(/\s+/).filter(Boolean).map(shortType);
  const properties: Record<string, SchemaValue> = {};

  const walk = (node: Element): void => {
    $(node)
      .children()
      .each((_i, child) => {
        const $child = $(child);
        const propName = $child.attr('property');
        const isScope = $child.attr('typeof') !== undefined;
        if (propName) {
          for (const name of propName.split(/\s+/).filter(Boolean)) {
            const value: SchemaValue = isScope
              ? ((normalizeRdfaItem($, $child, counter) as SchemaValue) ?? rdfaValue($, $child))
              : rdfaValue($, $child);
            if (value !== undefined && value !== '')
              addProp(properties, shortProperty(name), value);
          }
        }
        if (!isScope) walk(child);
      });
  };
  walk($item.get(0) as Element);

  const idRaw = $item.attr('resource') ?? $item.attr('about') ?? null;
  const source: RawSchemaBlock = {
    format: 'rdfa',
    raw: $.html($item) ?? '',
    location: `rdfa:${types[0] ?? 'item'}`,
  };
  return buildEntity(types, properties, 'rdfa', source, idRaw, counter);
}

function rdfaValue($: CheerioAPI, $el: Cheerio<Element>): string {
  const content = $el.attr('content');
  if (content !== undefined) return content;
  const tag = ($el.get(0) as { tagName?: string } | undefined)?.tagName?.toLowerCase();
  if (tag === 'a' || tag === 'link' || tag === 'area') return $el.attr('href') ?? $el.text().trim();
  if (tag === 'img') return $el.attr('src') ?? '';
  if (tag === 'time') return $el.attr('datetime') ?? $el.text().trim();
  const resource = $el.attr('resource');
  if (resource !== undefined) return resource;
  return $el.text().trim();
}

// ---------------- shared ----------------

function toTypes(raw: unknown): string[] {
  if (typeof raw === 'string') return [shortType(raw)];
  if (Array.isArray(raw))
    return raw.filter((t): t is string => typeof t === 'string').map(shortType);
  return [];
}

function addProp(properties: Record<string, SchemaValue>, key: string, value: SchemaValue): void {
  const existing = properties[key];
  if (existing === undefined) {
    properties[key] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    properties[key] = [existing, value];
  }
}

function buildEntity(
  types: string[],
  properties: Record<string, SchemaValue>,
  format: SchemaFormat,
  source: RawSchemaBlock,
  idRaw: string | null,
  counter: { n: number },
): SchemaEntity | null {
  if (types.length === 0 && Object.keys(properties).length === 0) return null;
  const primary = types[0] ?? '';
  const identity =
    idRaw ?? firstString(properties['url']) ?? firstString(properties['name']) ?? null;
  const id = idRaw ?? `_:b${counter.n++}`;
  const entityHash = stableHash({ types: [...types].sort(), properties: cleanProps(properties) });
  return { id, type: primary, types, format, properties, identity, entityHash, source };
}

/** Clean property map (ids/source excluded) for stable hashing. */
function cleanProps(properties: Record<string, SchemaValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(properties)) out[k] = cleanForHash(v);
  return out;
}

/** A representation of a value used for hashing/diffing: excludes ids and source. */
function cleanForHash(value: SchemaValue): unknown {
  if (Array.isArray(value)) return value.map(cleanForHash);
  if (value && typeof value === 'object') {
    if ('ref' in value) return { ref: (value as { ref: string }).ref };
    const entity = value as SchemaEntity;
    if ('entityHash' in entity && 'types' in entity) {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(entity.properties)) cleaned[k] = cleanForHash(v);
      return { types: [...entity.types].sort(), properties: cleaned };
    }
  }
  return value;
}

function firstString(value: SchemaValue | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = firstString(v);
      if (s) return s;
    }
  }
  return null;
}

export const _internal = { cleanForHash, rootNodes };
