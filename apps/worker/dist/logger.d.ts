import type { LoggerService } from '@nestjs/common';
/** pino adapter for Nest's LoggerService in a non-HTTP application context. */
export declare class WorkerLogger implements LoggerService {
    private readonly logger;
    constructor();
    log(message: unknown, context?: string): void;
    error(message: unknown, trace?: string, context?: string): void;
    warn(message: unknown, context?: string): void;
    debug(message: unknown, context?: string): void;
    verbose(message: unknown, context?: string): void;
}
