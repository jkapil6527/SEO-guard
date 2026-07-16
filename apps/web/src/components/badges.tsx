import type { ReactNode } from 'react';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {severity}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  resolving: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  queued: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  finalizing: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  // schema entity + fetch statuses
  valid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  warnings: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  errors: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  invalid_json: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  unchanged: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  redirected: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  carried_forward: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  // rich result eligibility
  eligible: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  eligible_with_warnings: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  ineligible: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
};

export function StatusBadge({ status, children }: { status: string; children?: ReactNode }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.queued;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {children ?? status.replace(/_/g, ' ')}
    </span>
  );
}

/** A small colored pill for arbitrary labels (schema types, formats, etc.). */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </span>
  );
}
