"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageFetchProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const shared_1 = require("@seo-guardian/shared");
const bullmq_2 = require("bullmq");
const page_processor_service_1 = require("../crawl/page-processor.service");
let PageFetchProcessor = class PageFetchProcessor extends bullmq_1.WorkerHost {
    pageProcessor;
    constructor(pageProcessor) {
        super();
        this.pageProcessor = pageProcessor;
    }
    async process(job, token) {
        try {
            const result = await this.pageProcessor.processFetch(job.data);
            // When routed to render, the render processor records progress and completion.
            if (!result.routedToRender) {
                await this.pageProcessor.finishPage(job.data, result.outcome);
            }
            return result;
        }
        catch (err) {
            if (err instanceof page_processor_service_1.RateLimitedError) {
                // Politeness/pause backpressure: delay-retry without consuming an attempt.
                await job.moveToDelayed(Date.now() + err.retryInMs, token);
                throw new bullmq_2.DelayedError();
            }
            throw err;
        }
    }
};
exports.PageFetchProcessor = PageFetchProcessor;
exports.PageFetchProcessor = PageFetchProcessor = __decorate([
    (0, bullmq_1.Processor)(shared_1.QUEUES.PAGE_FETCH, {
        concurrency: Number(process.env.FETCH_CONCURRENCY ?? 8),
    }),
    __metadata("design:paramtypes", [page_processor_service_1.PageProcessorService])
], PageFetchProcessor);
//# sourceMappingURL=page-fetch.processor.js.map