import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@seo-guardian/shared';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { ClassConstructor } from 'class-transformer';

/**
 * Manual DTO validation for endpoints whose body shape is discriminated at
 * runtime (e.g. url-source creation). Mirrors the global pipe's error format.
 */
export async function validateDto<T extends object>(
  cls: ClassConstructor<T>,
  payload: unknown,
): Promise<T> {
  const instance = plainToInstance(cls, payload, { enableImplicitConversion: false });
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'Request validation failed',
      errors: errors.flatMap((e) =>
        Object.values(e.constraints ?? {}).map((message) => ({ field: e.property, message })),
      ),
    });
  }
  return instance;
}
