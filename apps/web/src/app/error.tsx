'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary. Without this an uncaught render error shows a
 * blank white screen; here it surfaces the message and offers a retry.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error in the console for diagnosis.
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error.message || 'An unexpected error occurred while rendering this page.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-slate-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
