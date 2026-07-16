import type { UrlFilterOptions } from './types';
export type UrlClass = 'in_scope' | 'out_of_scope' | 'blocked';
/**
 * Decides whether a discovered URL belongs to the crawl.
 *
 * Scope (`isInScope`) is registrable-domain based: the URL shares the origin's
 * registrable domain (so `blog.example.com` is in scope for `example.com`) and,
 * when configured, its path sits under `pathScope`. Sub-scope filtering
 * (`isAllowed`) applies glob allow/block lists to the path independently of
 * scope. `classify` combines the two.
 *
 * The constructor throws on an unparseable `origin` — that is a programmer
 * error, not runtime input.
 */
export declare class UrlFilter {
    private readonly originDomain;
    private readonly pathScope;
    private readonly allow;
    private readonly block;
    constructor(options: UrlFilterOptions);
    /** Same registrable domain as the origin AND (when set) path under pathScope. */
    isInScope(url: string): boolean;
    /** Glob allow/block verdict over the path: block wins; allow restricts when set. */
    isAllowed(url: string): boolean;
    classify(url: string): UrlClass;
}
