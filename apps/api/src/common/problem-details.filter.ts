import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ERROR_CODES } from '@seo-guardian/shared';
import type { ProblemDetails } from '@seo-guardian/shared';
import type { Request, Response } from 'express';

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/** Normalizes every error into an RFC 7807 problem-details response. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERROR_CODES.INTERNAL;
    let detail: string | undefined;
    let errors: ProblemDetails['errors'];

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = ERROR_CODES.RATE_LIMITED;
      detail = 'Too many requests; slow down.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        detail = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        code = typeof b.code === 'string' ? b.code : defaultCode(status);
        errors = Array.isArray(b.errors) ? (b.errors as ProblemDetails['errors']) : undefined;
        if (typeof b.message === 'string') detail = b.message;
        else if (Array.isArray(b.message)) detail = (b.message as string[]).join('; ');
        else if (typeof b.detail === 'string') detail = b.detail;
      }
    } else {
      this.logger.error(
        { err: exception, path: req.url, method: req.method },
        'Unhandled exception',
      );
      detail = 'An unexpected error occurred.';
    }

    if (code === ERROR_CODES.INTERNAL && status !== HttpStatus.INTERNAL_SERVER_ERROR) {
      code = defaultCode(status);
    }

    const problem: ProblemDetails = {
      type: 'about:blank',
      title: TITLES[status] ?? 'Error',
      status,
      code,
      ...(detail ? { detail } : {}),
      ...(errors ? { errors } : {}),
    };

    res.status(status).type('application/problem+json').json(problem);
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return ERROR_CODES.VALIDATION_FAILED;
    case 401:
      return ERROR_CODES.INVALID_CREDENTIALS;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 409:
      return ERROR_CODES.CONFLICT;
    case 429:
      return ERROR_CODES.RATE_LIMITED;
    default:
      return ERROR_CODES.INTERNAL;
  }
}
