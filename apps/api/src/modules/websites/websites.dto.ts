import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ERROR_CODES } from '@seo-guardian/shared';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWebsiteDto {
  @ApiProperty({ example: 'CarDekho Web' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'https://www.cardekho.com' })
  @IsString()
  @MaxLength(500)
  origin: string;

  @ApiPropertyOptional({ example: '/', default: '/' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^\//, { message: 'pathScope must start with /' })
  pathScope?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class UpdateWebsiteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Normalizes an origin: http(s) only, no credentials/path/query/fragment,
 * lowercased host, default ports stripped.
 */
export function normalizeOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: `origin is not a valid URL: ${raw}`,
    });
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'origin must use http or https',
    });
  }
  if (url.username || url.password) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'origin must not contain credentials',
    });
  }
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'origin must not contain a path, query or fragment; use pathScope instead',
    });
  }
  return url.origin;
}
