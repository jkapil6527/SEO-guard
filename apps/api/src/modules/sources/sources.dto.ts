import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Creation payloads are separate DTOs per source type (discriminated by endpoint
 * body `type` handled in the service) to keep validation exact per shape.
 */
export class CreateManualSourceDto {
  @ApiProperty({ enum: ['manual'] })
  @Equals('manual')
  type: 'manual';

  @ApiProperty({ type: [String], maxItems: 10000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  urls: string[];
}

export class CreateSitemapSourceDto {
  @ApiProperty({ enum: ['sitemap'] })
  @Equals('sitemap')
  type: 'sitemap';

  @ApiProperty({ example: 'https://www.cardekho.com/sitemap.xml' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  sitemapUrl: string;
}

export class CreateDiscoverySourceDto {
  @ApiProperty({ enum: ['discovery'] })
  @Equals('discovery')
  type: 'discovery';

  @ApiProperty({ type: [String], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  seeds: string[];

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxDepth?: number;

  @ApiPropertyOptional({ default: 10000, minimum: 1, maximum: 1000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxPages?: number;
}

export class CsvUploadFieldsDto {
  @ApiPropertyOptional({ default: 'url', description: 'CSV column containing URLs' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  urlColumn?: string;
}
