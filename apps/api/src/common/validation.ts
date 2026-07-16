import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import { ERROR_CODES } from '@seo-guardian/shared';

function flatten(
  errors: ValidationError[],
  parent = '',
): Array<{ field: string; message: string }> {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((message) => ({ field, message }));
    const nested = e.children?.length ? flatten(e.children, field) : [];
    return [...own, ...nested];
  });
}

/** Global validation pipe producing structured field errors for the problem-details filter. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Request validation failed',
        errors: flatten(errors),
      }),
  });
}
