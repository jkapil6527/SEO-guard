'use client';

import { useEffect, useState } from 'react';
import { sseUrl } from '@/lib/api';
import type { CrawlProgress } from '@/lib/types';

/**
 * Subscribes to a crawl's live progress over SSE. Returns the latest event, or
 * null before the first message. The stream completes itself when the crawl
 * finishes (the server closes it). Auth is removed, so EventSource — which can't
 * send headers — works directly.
 */
export function useCrawlProgress(
  crawlId: string | undefined,
  active: boolean,
): CrawlProgress | null {
  const [progress, setProgress] = useState<CrawlProgress | null>(null);

  useEffect(() => {
    if (!crawlId || !active) return;
    const source = new EventSource(sseUrl(`/crawls/${crawlId}/progress`));
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CrawlProgress;
        setProgress(data);
        if (data.finishedAt) source.close();
      } catch {
        // ignore malformed frames
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [crawlId, active]);

  return progress;
}
