'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import { IconChevronDown } from '@/components/icons';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Server-side sort key. Omit to make the column unsortable. */
  sortKey?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Header-cell width, e.g. 'w-40'. */
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Rows become real links — keyboard-operable, cmd-clickable, unlike an onClick <tr>. */
  rowHref?: (row: T) => string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  sort?: string | null;
  dir?: 'asc' | 'desc' | null;
  onSort?: (key: string) => void;
  empty?: ReactNode;
  stickyHeader?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  selectable = false,
  selected = new Set(),
  onSelectedChange,
  sort,
  dir,
  onSort,
  empty,
  stickyHeader = true,
}: DataTableProps<T>) {
  const allKeys = rows.map(rowKey);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const someSelected = allKeys.some((k) => selected.has(k)) && !allSelected;

  const toggleAll = () => {
    if (!onSelectedChange) return;
    onSelectedChange(allSelected ? new Set() : new Set(allKeys));
  };
  const toggleOne = (key: string) => {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange(next);
  };

  if (rows.length === 0 && empty) return <>{empty}</>;

  const alignOf = (a?: string) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className={cn('bg-surface-2', stickyHeader && 'sticky top-0 z-10')}>
            {selectable && (
              <th scope="col" className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-border-strong accent-[var(--primary)]"
                />
              </th>
            )}
            {columns.map((col) => {
              const active = col.sortKey && sort === col.sortKey;
              const ariaSort = active
                ? dir === 'asc'
                  ? 'ascending'
                  : 'descending'
                : col.sortKey
                  ? 'none'
                  : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    'border-b border-border px-4 py-2.5 text-xs font-semibold tracking-wide text-faint uppercase',
                    alignOf(col.align),
                    col.width,
                  )}
                >
                  {col.sortKey && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.sortKey as string)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded transition-colors hover:text-text',
                        active && 'text-primary',
                      )}
                    >
                      {col.header}
                      <IconChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          !active && 'opacity-30',
                          active && dir === 'asc' && 'rotate-180',
                        )}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                className={cn(
                  'border-b border-border transition-colors last:border-b-0 hover:bg-surface-hover',
                  selected.has(key) && 'bg-primary-soft',
                )}
              >
                {selectable && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${key}`}
                      checked={selected.has(key)}
                      onChange={() => toggleOne(key)}
                      className="h-4 w-4 rounded border-border-strong accent-[var(--primary)]"
                    />
                  </td>
                )}
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-2.5 text-text', alignOf(col.align), col.className)}
                  >
                    {/* The first cell carries the link, so the row is reachable by
                        keyboard and openable in a new tab — an onClick <tr> is neither. */}
                    {i === 0 && rowHref ? (
                      <Link
                        href={rowHref(row)}
                        className="block rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {col.render(row)}
                      </Link>
                    ) : (
                      col.render(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Bulk action bar — appears only when rows are selected. */
export function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-2.5"
    >
      <span className="text-sm font-medium text-text">{count} selected</span>
      <div className="flex flex-wrap gap-2">{children}</div>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-sm text-muted underline-offset-2 hover:text-text hover:underline"
      >
        Clear
      </button>
    </div>
  );
}
