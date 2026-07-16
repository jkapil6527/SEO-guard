'use client';

import { useEffect, useState } from 'react';
import { Input, Select } from '@/components/primitives/input';
import { useTableState } from '@/hooks/use-table-state';
import { IconX } from '@/components/icons';

export interface FilterDef {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

/**
 * Declarative filters bound to the URL. One implementation replaces the three
 * incompatible hand-rolled ones (toggle chips, chip rows, bare selects), and the
 * search box debounces instead of firing a query per keystroke.
 */
export function FilterBar({
  filters,
  searchKey = 'q',
  searchPlaceholder = 'Search…',
  resultCount,
}: {
  filters: FilterDef[];
  searchKey?: string;
  searchPlaceholder?: string;
  resultCount?: number;
}) {
  const { get, set, activeFilters, clearAll } = useTableState();
  const [term, setTerm] = useState(get(searchKey));

  // Debounce: the old schema filter re-queried on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      if (term !== get(searchKey)) set(searchKey, term || null);
    }, 300);
    return () => clearTimeout(id);
  }, [term, get, set, searchKey]);

  const labelFor = (key: string, value: string) => {
    const f = filters.find((x) => x.key === key);
    if (!f) return `${key}: ${value}`;
    return `${f.label}: ${f.options.find((o) => o.value === value)?.label ?? value}`;
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-full sm:w-72"
        />
        {filters.map((f) => (
          <Select
            key={f.key}
            value={get(f.key)}
            onChange={(e) => set(f.key, e.target.value || null)}
            aria-label={f.label}
            className="h-9 w-auto"
          >
            <option value="">{f.label}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
      </div>

      {(activeFilters.length > 0 || resultCount !== undefined) && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => set(key, null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              {labelFor(key, value)}
              <IconX className="h-3 w-3" />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted underline-offset-2 hover:text-text hover:underline"
            >
              Clear all
            </button>
          )}
          {resultCount !== undefined && (
            <span className="ml-auto text-xs text-muted tabular-nums">
              {resultCount.toLocaleString()} {resultCount === 1 ? 'result' : 'results'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
