/** schema.org short name from a full or prefixed type IRI. */
export declare function shortType(type: string): string;
/** schema.org short property name from a full/prefixed property IRI. */
export declare function shortProperty(prop: string): string;
/** Deterministic sha256 hex of a canonicalized value (stable across runs). */
export declare function stableHash(value: unknown): string;
/** Canonical JSON: object keys sorted recursively, so equal content hashes equal. */
export declare function canonicalize(value: unknown): string;
export declare function isIsoDate(value: string): boolean;
export declare function isHttpUrl(value: string): boolean;
export declare function isNumeric(value: unknown): boolean;
export declare function isInteger(value: unknown): boolean;
export declare function isBooleanish(value: unknown): boolean;
