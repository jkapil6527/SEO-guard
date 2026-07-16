import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUES } from '@seo-guardian/shared';
import type { PageFetchJobData } from '@seo-guardian/shared';
import { DelayedError } from 'bullmq';
import type { Job } from 'bullmq';
import { PageProcessorService, RateLimitedError } from '../crawl/page-processor.service';

@Processor(QUEUES.PAGE_FETCH, {
  concurrency: Number(process.env.FETCH_CONCURRENCY ?? 8),
})
export class PageFetchProcessor extends WorkerHost {
  constructor(private readonly pageProcessor: PageProcessorService) {
    super();
  }

  override async process(job: Job<PageFetchJobData>, token?: string): Promise<unknown> {
    try {
      const result = await this.pageProcessor.processFetch(job.data);
      // When routed to render, the render processor records progress and completion.
      if (!result.routedToRender) {
        await this.pageProcessor.finishPage(job.data, result.outcome);
      }
      return result;
    } catch (err) {
      if (err instanceof RateLimitedError) {
        // Politeness/pause backpressure: delay-retry without consuming an attempt.
        await job.moveToDelayed(Date.now() + err.retryInMs, token);
        throw new DelayedError();
      }
      throw err;
    }
  }
}
