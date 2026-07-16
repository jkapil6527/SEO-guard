import type { LoggerService } from '@nestjs/common';
import pino from 'pino';
import type { Logger as Pino } from 'pino';

/** pino adapter for Nest's LoggerService in a non-HTTP application context. */
export class WorkerLogger implements LoggerService {
  private readonly logger: Pino;

  constructor() {
    this.logger = pino({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    });
  }

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }
}
