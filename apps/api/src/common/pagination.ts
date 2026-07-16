import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ERROR_CODES } from '@seo-guardian/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CursorQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor from meta.nextCursor' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export interface TimeCursor {
  createdAt: Date;
  id: string;
}

export function encodeTimeCursor(cursor: TimeCursor): string {
  return Buffer.from(
    JSON.stringify({ t: cursor.createdAt.toISOString(), i: cursor.id }),
    'utf8',
  ).toString('base64url');
}

export function decodeTimeCursor(raw: string): TimeCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      t: string;
      i: string;
    };
    const createdAt = new Date(parsed.t);
    if (Number.isNaN(createdAt.getTime()) || typeof parsed.i !== 'string') throw new Error();
    return { createdAt, id: parsed.i };
  } catch {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'Malformed pagination cursor',
    });
  }
}
