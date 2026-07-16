'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { SeverityBadge, Pill } from '@/components/primitives/badge';
import { IconChevronDown } from '@/components/icons';
import type { SchemaEntity } from '@/lib/types';

const STATUS_TONE: Record<string, string> = {
  valid: 'text-success bg-success/10 border-success/25',
  warnings: 'text-medium bg-medium/10 border-medium/25',
  errors: 'text-critical bg-critical/10 border-critical/25',
  invalid_json: 'text-critical bg-critical/10 border-critical/25',
};

/**
 * One structured-data entity, with per-property validation.
 *
 * The "where" of a schema issue is the entity type, the format it was written in
 * (JSON-LD / Microdata / RDFa), and the exact property at fault — all of which
 * the engine already records and nothing ever displayed.
 */
export function SchemaCard({ entity }: { entity: SchemaEntity }) {
  const [open, setOpen] = useState(entity.status === 'errors');
  const v = entity.validation ?? {};
  const results = v.results ?? [];
  const failures = results.filter((r) => r.status !== 'pass');

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize',
            STATUS_TONE[entity.status] ?? STATUS_TONE.valid,
          )}
        >
          {entity.status.replace('_', ' ')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-text">{entity.schemaType}</span>
          <span className="mt-0.5 block text-xs text-muted">
            {failures.length > 0
              ? `${failures.length} problem${failures.length === 1 ? '' : 's'}`
              : 'No problems'}
          </span>
        </span>
        <Pill>{entity.format}</Pill>
        <IconChevronDown
          className={cn('h-4 w-4 shrink-0 text-faint transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          {failures.length > 0 && (
            <div className="space-y-2.5">
              {failures.map((r, i) => (
                <div key={i} className="rounded-md border border-border bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={r.severity} />
                    {r.property && (
                      <code className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-text">
                        {r.property}
                      </code>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-text">{r.message}</p>
                  {r.technicalExplanation && (
                    <p className="mt-1 text-xs text-muted">{r.technicalExplanation}</p>
                  )}
                  {r.suggestedFix && (
                    <p className="mt-1.5 text-xs">
                      <span className="font-semibold text-faint">Fix: </span>
                      <span className="text-muted">{r.suggestedFix}</span>
                    </p>
                  )}
                  {r.specUrl && (
                    <a
                      href={r.specUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-xs text-primary hover:underline"
                    >
                      {r.specUrl.replace('https://', '')} ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <PropList label="Missing required" values={v.missingRequired} tone="danger" />
          <PropList label="Missing recommended" values={v.missingRecommended} tone="warning" />
          <PropList label="Invalid properties" values={v.invalidProperties} tone="danger" />
          <PropList label="Deprecated properties" values={v.deprecatedProperties} tone="warning" />

          {entity.richResults && entity.richResults.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-faint uppercase">
                Google rich results
              </p>
              <ul className="space-y-1">
                {entity.richResults.map((rr) => (
                  <li key={rr.profile} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        rr.eligible ? 'bg-success' : 'bg-danger',
                      )}
                    />
                    <span className="font-medium text-text">{rr.profile}</span>
                    <span className="text-muted">{rr.reason || rr.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-faint uppercase">
              Detected properties
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-surface-2 p-2.5 font-mono text-xs text-muted">
              {JSON.stringify(entity.properties, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PropList({
  label,
  values,
  tone,
}: {
  label: string;
  values?: string[];
  tone: 'danger' | 'warning';
}) {
  if (!values || values.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-faint uppercase">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((p) => (
          <code
            key={p}
            className={cn(
              'rounded border px-1.5 py-0.5 font-mono text-xs',
              tone === 'danger'
                ? 'border-danger/30 bg-danger-soft text-danger'
                : 'border-warning/30 bg-warning-soft text-warning',
            )}
          >
            {p}
          </code>
        ))}
      </div>
    </div>
  );
}
