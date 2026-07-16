'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStartCrawl } from '@/features/crawls/api';
import { useDismissable } from '@/lib/use-dismissable';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/modal';
import {
  FieldError,
  FormError,
  inputClasses,
  labelClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '@/components/form';
import { IconChevronDown, IconPlus, IconSpinner } from '@/components/icons';

/**
 * Starts a crawl and navigates to it. The main button runs an incremental
 * site crawl; the dropdown offers a full site crawl or a single-page crawl,
 * which prompts for the one URL to check.
 */
export function StartCrawlButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const start = useStartCrawl(websiteId);
  const [open, setOpen] = useState(false);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(ref, open, () => setOpen(false));

  const run = async (mode: 'full' | 'incremental') => {
    setOpen(false);
    try {
      const res = await start.mutateAsync({ mode, scope: 'site' });
      router.push(`/crawls/${res.crawlId}`);
    } catch {
      // error toast could go here; mutation error is available on start.error
    }
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => run('incremental')}
        disabled={start.isPending}
        className={`${primaryButtonClasses} rounded-r-none`}
      >
        <IconPlus className="h-4 w-4" />
        {start.isPending ? 'Starting…' : 'Start crawl'}
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Crawl options"
        disabled={start.isPending}
        className={`${primaryButtonClasses} rounded-l-none border-l border-blue-500 px-2`}
      >
        <IconChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => run('incremental')}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Incremental crawl
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Only changed pages
            </span>
          </button>
          <button
            type="button"
            onClick={() => run('full')}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Full crawl
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Re-fetch every page
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPageModalOpen(true);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Single page…
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Check one URL, no link following
            </span>
          </button>
        </div>
      )}
      <SinglePageModal
        websiteId={websiteId}
        open={pageModalOpen}
        onClose={() => setPageModalOpen(false)}
      />
    </div>
  );
}

function SinglePageModal({
  websiteId,
  open,
  onClose,
}: {
  websiteId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const start = useStartCrawl(websiteId);
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const close = () => {
    setUrl('');
    setUrlError(null);
    setFormError(null);
    onClose();
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setUrlError(null);
    setFormError(null);
    try {
      const res = await start.mutateAsync({ mode: 'full', scope: 'page', url });
      close();
      router.push(`/crawls/${res.crawlId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const field = err.fieldErrors.find((f) => f.field === 'url');
        if (field) setUrlError(field.message);
        else setFormError(err.message);
      } else {
        setFormError('Unable to reach the server. Please try again.');
      }
    }
  };

  return (
    <Modal open={open} onClose={close} title="Crawl a single page">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <div>
          <label htmlFor="single-page-url" className={labelClasses}>
            Page URL
          </label>
          <input
            id="single-page-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/pricing"
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? 'single-page-url-error' : 'single-page-url-hint'}
            className={inputClasses}
          />
          <FieldError id="single-page-url-error" message={urlError ?? undefined} />
          {!urlError && (
            <p
              id="single-page-url-hint"
              className="mt-1.5 text-xs text-slate-500 dark:text-slate-400"
            >
              Must be on this website&apos;s origin. Only this page is fetched — its links are
              checked, but not followed.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={close} className={secondaryButtonClasses}>
            Cancel
          </button>
          <button type="submit" disabled={start.isPending} className={primaryButtonClasses}>
            {start.isPending && <IconSpinner className="h-4 w-4" />}
            {start.isPending ? 'Starting…' : 'Crawl page'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
