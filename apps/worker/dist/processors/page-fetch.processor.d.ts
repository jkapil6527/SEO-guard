import { WorkerHost } from '@nestjs/bullmq';
import type { PageFetchJobData } from '@seo-guardian/shared';
import type { Job } from 'bullmq';
import { PageProcessorService } from '../crawl/page-processor.service';
export declare class PageFetchProcessor extends WorkerHost {
    private readonly pageProcessor;
    constructor(pageProcessor: PageProcessorService);
    process(job: Job<PageFetchJobData>, token?: string): Promise<unknown>;
}
