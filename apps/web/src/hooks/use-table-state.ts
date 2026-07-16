'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Table/filter state lives in the URL, not component state.
 *
 * Everything the user narrows to — search, filters, sort, page — becomes a
 * shareable link and survives back/forward navigation. Previously all of this
 * sat in local `useState` and was destroyed on any navigation.
 */
export function useTableState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const get = useCallback((key: string, fallback = '') => params.get(key) ?? fallback, [params]);

  const setMany = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      // Any change to a filter invalidates the cursor into the old result set.
      if (!('cursor' in patch)) next.delete('cursor');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const set = useCallback(
    (key: string, value: string | null) => setMany({ [key]: value }),
    [setMany],
  );

  const toggleSort = useCallback(
    (column: string) => {
      const current = params.get('sort');
      const dir = params.get('dir');
      if (current !== column) setMany({ sort: column, dir: 'asc' });
      else if (dir === 'asc') setMany({ sort: column, dir: 'desc' });
      else setMany({ sort: null, dir: null });
    },
    [params, setMany],
  );

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  /** Filters currently narrowing the view — excludes sort/pagination plumbing. */
  const activeFilters = Array.from(params.entries()).filter(
    ([k, v]) => !['sort', 'dir', 'cursor', 'page'].includes(k) && v !== '',
  );

  return {
    params,
    get,
    set,
    setMany,
    toggleSort,
    clearAll,
    activeFilters,
    sort: params.get('sort'),
    dir: (params.get('dir') as 'asc' | 'desc' | null) ?? null,
  };
}

/** Serialise the current table state into an API query string. */
export function toQuery(params: URLSearchParams, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params.toString());
  for (const [k, v] of Object.entries(extra)) qs.set(k, v);
  return qs.toString();
}
