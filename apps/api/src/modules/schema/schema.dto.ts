import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SchemaEntityQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Filter by schema type, e.g. Article' })
  @IsOptional()
  @IsString()
  schemaType?: string;

  @ApiPropertyOptional({ description: 'valid | warnings | errors | invalid_json' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'json-ld | microdata | rdfa' })
  @IsOptional()
  @IsString()
  format?: string;
}

export class SchemaChangeQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Filter by change type' })
  @IsOptional()
  @IsString()
  changeType?: string;
}
