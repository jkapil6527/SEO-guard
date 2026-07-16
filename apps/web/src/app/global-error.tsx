'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — catches errors thrown in the root layout itself.
 * Must render its own <html>/<body>. Prevents the fully-blank white screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0b1120',
          color: '#e2e8f0',
        }}
      >
        <div style={{ maxWidth: 480, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>The application failed to load</h1>
          <p style={{ fontSize: 14, color: '#f87171', marginBottom: 16 }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
            If this persists, ensure the API is running at its configured URL, then reload.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#e2e8f0',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
