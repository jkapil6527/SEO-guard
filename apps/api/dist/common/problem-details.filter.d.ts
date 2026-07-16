import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
/** Normalizes every error into an RFC 7807 problem-details response. */
export declare class ProblemDetailsFilter implements ExceptionFilter {
    private readonly logger;
    catch(exception: unknown, host: ArgumentsHost): void;
}
