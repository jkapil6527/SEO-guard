'use client';

import type { ReactNode } from 'react';
import { IconSpinner } from '@/components/icons';

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-800">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Wraps a React Query result with consistent loading/error/empty handling. */
export function QueryBoundary<T>({
  query,
  isEmpty,
  empty,
  children,
  loadingLabel = 'Loading…',
}: {
  query: { isPending: boolean; isError: boolean; error?: { message: string } | null; data?: T };
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}) {
  if (query.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-12 text-slate-400">
        <IconSpinner className="h-5 w-5" />
        <span className="text-sm">{loadingLabel}</span>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      >
        {query.error?.message ?? 'Something went wrong.'}
      </div>
    );
  }
  const data = query.data as T;
  if (isEmpty?.(data)) {
    return <>{empty}</>;
  }
  return <>{children(data)}</>;
}

export function ProgressBar({ percent, className = '' }: { percent: number; className?: string }) {
  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}
    >
      <div
        className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </Card>
  );
}
