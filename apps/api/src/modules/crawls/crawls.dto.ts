import { ApiPropertyOptional } from '@nestjs/swagger';
import { CrawlMode, CrawlScope, IssueSeverity } from '@seo-guardian/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class StartCrawlDto {
  @ApiPropertyOptional({ enum: CrawlMode, default: CrawlMode.Incremental })
  @IsOptional()
  @IsEnum(CrawlMode)
  mode?: CrawlMode;

  @ApiPropertyOptional({ enum: CrawlScope, default: CrawlScope.Site })
  @IsOptional()
  @IsEnum(CrawlScope)
  scope?: CrawlScope;

  @ApiPropertyOptional({
    description:
      "Single page to crawl; required when scope is 'page'. Must match the website origin.",
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: "Category to crawl; required when scope is 'group'." })
  @IsOptional()
  @IsUUID()
  sitemapGroupId?: string;
}

export class CrawlReportQueryDto {
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

  @ApiPropertyOptional({ description: 'Narrow the feed to a single project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class CrawlPageQueryDto {
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

  @ApiPropertyOptional({ description: 'ok|unchanged|redirected|error|carried_forward' })
  @IsOptional()
  @IsString()
  fetchStatus?: string;
}

export class CrawlIssueQueryDto {
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

  @ApiPropertyOptional({ enum: IssueSeverity, isArray: true, description: 'Comma-separated' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(5)
  @IsEnum(IssueSeverity, { each: true })
  severity?: IssueSeverity[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checkId?: string;
}
