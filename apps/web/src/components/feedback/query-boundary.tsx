'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/primitives/button';
import { Skeleton } from '@/components/primitives/skeleton';

interface QueryLike<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  refetch?: () => void;
}

/**
 * One place that renders loading / error / empty for a query.
 *
 * Improves on the original in three ways: a caller-supplied skeleton instead of
 * a bare spinner, a working retry button in the error state, and no unchecked
 * cast — `data` is narrowed before it reaches the child.
 */
export function QueryBoundary<T>({
  query,
  children,
  skeleton,
  isEmpty,
  empty,
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
}) {
  if (query.isPending) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading">
        {skeleton ?? <Skeleton className="h-32 w-full" />}
      </div>
    );
  }

  if (query.isError) {
    const message =
      query.error instanceof Error ? query.error.message : 'Something went wrong.';
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4"
      >
        <div>
          <p className="text-sm font-medium text-danger">Couldn&apos;t load this</p>
          <p className="mt-0.5 text-sm text-muted">{message}</p>
        </div>
        {query.refetch && (
          <Button variant="secondary" size="sm" onClick={() => query.refetch?.()}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (query.data === undefined) {
    return null;
  }
  if (isEmpty?.(query.data)) {
    return <>{empty}</>;
  }
  return <>{children(query.data)}</>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="text-sm font-semibold text-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
