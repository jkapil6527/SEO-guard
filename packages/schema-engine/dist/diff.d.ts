import type { SchemaChange, SchemaEntitySummary } from './types';
/**
 * Diffs the schema entities of one page between two crawls. Entities are matched
 * by (type, identity) when an identity exists, else by type + entity hash. The
 * result powers historical schema-change reports. Pure.
 *
 * Severity policy: removing an entity or a previously-present property is High
 * (it can drop a rich result); additions and value changes are Info/Low.
 */
export declare function diffPageSchema(before: SchemaEntitySummary[], after: SchemaEntitySummary[]): SchemaChange[];
