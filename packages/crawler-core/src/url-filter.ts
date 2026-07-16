/**
 * Crawl-scope filter: registrable-domain scoping, an optional path-scope prefix
 * and glob-style allow/block lists evaluated against the URL path.
 */
import { registrableDomain } from './url';
import type { UrlFilterOptions } from './types';

/**
 * Compiles a glob into an anchored RegExp over the URL pathname:
 *   `**` matches any character sequence including `/`
 *   `*`  matches any sequence except `/`
 *   `?`  matches a single character except `/`
 */
function globToRegex(glob: string): RegExp {
  // Patterns that don't start with '/' or a wildcard are rooted at '/'.
  const pattern =
    glob.startsWith('/') || glob.startsWith('*') || glob.startsWith('?') ? glob : `/${glob}`;
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern.charAt(i);
    if (char === '*') {
      if (pattern.charAt(i + 1) === '*') {
        out += '.*';
        i += 1;
      } else {
        out += '[^/]*';
      }
    } else if (char === '?') {
      out += '[^/]';
    } else {
      out += char.replace(/[.+^${}()|[\]\\]/, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

/** True when `path` equals the scope or sits beneath it (segment-safe). */
function underScope(path: string, scope: string): boolean {
  if (scope.endsWith('/')) {
    return path === scope.slice(0, -1) || path.startsWith(scope);
  }
  return path === scope || path.startsWith(`${scope}/`);
}

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
export class UrlFilter {
  private readonly originDomain: string;
  private readonly pathScope: string | null;
  private readonly allow: RegExp[];
  private readonly block: RegExp[];

  constructor(options: UrlFilterOptions) {
    this.originDomain = registrableDomain(new URL(options.origin).hostname);
    if (options.pathScope !== undefined && options.pathScope !== '') {
      this.pathScope = options.pathScope.startsWith('/')
        ? options.pathScope
        : `/${options.pathScope}`;
    } else {
      this.pathScope = null;
    }
    this.allow = (options.allow ?? []).map(globToRegex);
    this.block = (options.block ?? []).map(globToRegex);
  }

  /** Same registrable domain as the origin AND (when set) path under pathScope. */
  isInScope(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (registrableDomain(parsed.hostname) !== this.originDomain) {
      return false;
    }
    if (this.pathScope !== null && !underScope(parsed.pathname, this.pathScope)) {
      return false;
    }
    return true;
  }

  /** Glob allow/block verdict over the path: block wins; allow restricts when set. */
  isAllowed(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    const path = parsed.pathname;
    if (this.block.some((re) => re.test(path))) {
      return false;
    }
    if (this.allow.length > 0 && !this.allow.some((re) => re.test(path))) {
      return false;
    }
    return true;
  }

  classify(url: string): UrlClass {
    if (!this.isInScope(url)) {
      return 'out_of_scope';
    }
    return this.isAllowed(url) ? 'in_scope' : 'blocked';
  }
}
