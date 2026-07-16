import type { ExtractionResult, SchemaValue } from './types';
/**
 * Extracts all structured data from an HTML document across JSON-LD, Microdata
 * and RDFa, normalizing every instance into a SchemaEntity graph. Pure and
 * tolerant: malformed blocks are recorded in `parseErrors`, never thrown.
 */
export declare function extractStructuredData(html: string): ExtractionResult;
declare function rootNodes(parsed: unknown): Array<Record<string, unknown>>;
/** A representation of a value used for hashing/diffing: excludes ids and source. */
declare function cleanForHash(value: SchemaValue): unknown;
export declare const _internal: {
    cleanForHash: typeof cleanForHash;
    rootNodes: typeof rootNodes;
};
export {};
