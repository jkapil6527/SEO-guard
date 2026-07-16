import type { CheckDefinition } from '../types';
/**
 * Redirect chains longer than this many hops are flagged. Lives here (a leaf
 * module) rather than in the catalog, which imports the checks — the reverse
 * edge would close an import cycle.
 */
export declare const MAX_REDIRECT_HOPS = 2;
export declare const linkChecks: CheckDefinition[];
