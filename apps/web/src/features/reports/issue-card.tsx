'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SeverityBadge } from '@/components/primitives/badge';
import { cn } from '@/utils/cn';
import { IconChevronDown } from '@/components/icons';
import type { IssueDetail } from '@/lib/types';

/**
 * One finding, fully explained: what is wrong, WHERE on the page it is, why it
 * matters, and how to fix it.
 *
 * The "where" is the point of this component. Previously an issue could only say
 * "an H2 is empty" — now it names the exact element (CSS selector), shows the
 * offending markup, and for a duplicate title lists the other URLs it collides
 * with.
 */
export function IssueCard({ issue }: { issue: IssueDetail }) {
  const [open, setOpen] = useState(false);
  const e = issue.evidence;
  const check = issue.check;

  const where = locationOf(issue);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <SeverityBadge severity={issue.severity} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-text">
            {check?.name ?? issue.checkId}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {e.message ?? check?.description}
          </span>
          {where && (
            <span className="mt-1 block truncate font-mono text-xs text-primary">{where}</span>
          )}
        </span>
        <IconChevronDown
          className={cn('mt-1 h-4 w-4 shrink-0 text-faint transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          {/* ---- WHERE: the exact location on the page ---- */}
          <Field label="Where">
            {/* Link/image issues: the target URL is the primary "where". */}
            {e.target && (
              <p className="mb-2 font-mono text-xs break-all">
                <span className="text-faint">{isImageIssue(issue) ? 'Image' : 'Link'} → </span>
                <a
                  href={e.target}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {e.target}
                </a>
              </p>
            )}

            {e.selector ? (
              <>
                <p className="text-xs text-muted">
                  <span className="text-faint">On page at </span>
                  <span className="font-mono text-text">{e.selector}</span>
                </p>
                {e.snippet && (
                  <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-surface-2 p-2.5 font-mono text-xs text-muted">
                    {e.snippet}
                  </pre>
                )}
              </>
            ) : e.affectedElement && !e.target ? (
              <p className="font-mono text-xs break-all text-text">{e.affectedElement}</p>
            ) : !e.target ? (
              <p className="text-xs text-muted">
                Page-level — this applies to the document, not one element.
              </p>
            ) : (
              <p className="text-xs text-faint">
                Exact element location available on crawls run after this feature — re-crawl to
                capture it.
              </p>
            )}

            {e.anchorText && (
              <p className="mt-1.5 text-xs text-muted">
                Anchor text: <span className="text-text">“{e.anchorText}”</span>
              </p>
            )}
            {(e.status ?? e.httpStatus) != null && (
              <p className="mt-1.5 text-xs text-muted">
                Returned{' '}
                <span className="font-semibold text-danger">HTTP {e.status ?? e.httpStatus}</span>
              </p>
            )}
            {e.error && (
              <p className="mt-1.5 text-xs text-muted">
                Error: <span className="font-mono text-danger">{e.error}</span>
              </p>
            )}
            {(e.redirectHops ?? e.hops) != null && (
              <p className="mt-1.5 text-xs text-muted">
                Redirect hops:{' '}
                <span className="font-semibold text-text">{e.redirectHops ?? e.hops}</span>
              </p>
            )}
            {e.from != null && e.to != null && (
              <p className="mt-1.5 text-xs text-muted">
                Jumps from <span className="text-text">H{e.from}</span> to{' '}
                <span className="text-text">H{e.to}</span>
              </p>
            )}
          </Field>

          {/* ---- Duplicates: the colliding URLs ---- */}
          {issue.duplicateOf && (
            <Field label={`Shared with ${issue.duplicateOf.pageCount - 1} other page(s)`}>
              <p className="mb-2 rounded-md border border-border bg-surface-2 p-2 font-mono text-xs break-words text-text">
                {issue.duplicateOf.sample}
              </p>
              <ul className="space-y-1">
                {issue.duplicateOf.urls.slice(0, 25).map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate font-mono text-xs text-primary hover:underline"
                    >
                      {pathOf(url)}
                    </a>
                  </li>
                ))}
              </ul>
              {issue.duplicateOf.urls.length > 25 && (
                <p className="mt-1 text-xs text-faint">
                  + {issue.duplicateOf.urls.length - 25} more
                </p>
              )}
            </Field>
          )}

          {/* ---- Multiple H1s etc: several locations ---- */}
          {Array.isArray(e.locations) && e.locations.length > 0 && (
            <Field label="All occurrences">
              <ul className="space-y-1.5">
                {e.locations.map((loc, i) => (
                  <li key={i} className="font-mono text-xs">
                    <span className="text-primary">{loc.selector}</span>
                    {loc.snippet && <span className="block truncate text-muted">{loc.snippet}</span>}
                  </li>
                ))}
              </ul>
            </Field>
          )}

          {(e.technicalExplanation ?? check?.technicalExplanation) && (
            <Field label="Why it matters">
              <p className="text-xs text-muted">
                {e.technicalExplanation ?? check?.technicalExplanation}
              </p>
            </Field>
          )}

          {check?.businessImpact && check.businessImpact !== check.description && (
            <Field label="Impact">
              <p className="text-xs text-muted">{check.businessImpact}</p>
            </Field>
          )}

          {(e.suggestedFix ?? check?.suggestedFix) && (
            <Field label="How to fix">
              <p className="text-xs text-muted">{e.suggestedFix ?? check?.suggestedFix}</p>
            </Field>
          )}

          <div className="flex items-center gap-4 text-xs">
            {check?.docUrl && (
              <Link
                href={check.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Reference ↗
              </Link>
            )}
            <span className="font-mono text-faint">{issue.checkId}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold tracking-wide text-faint uppercase">{label}</p>
      {children}
    </div>
  );
}

function isImageIssue(issue: IssueDetail): boolean {
  return issue.checkId.startsWith('images.');
}

/** The one-line "where" shown on the collapsed row. */
function locationOf(issue: IssueDetail): string | null {
  const e = issue.evidence;
  if (e.target) return e.target;
  if (e.selector) return e.selector;
  if (issue.duplicateOf) return `shared with ${issue.duplicateOf.pageCount - 1} other page(s)`;
  if (e.affectedElement) return e.affectedElement;
  return null;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}
