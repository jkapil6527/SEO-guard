import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrawlMode } from '@seo-guardian/shared';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateSitemapGroupDto {
  @ApiProperty({ description: 'Website this category belongs to' })
  @IsUUID()
  websiteId!: string;

  @ApiProperty({ example: 'Model Pages' })
  @IsString()
  @Length(2, 60)
  name!: string;

  @ApiPropertyOptional({ example: 'https://www.bikedekho.com/sitemap-models.xml' })
  @IsOptional()
  @IsString()
  sitemapUrl?: string;
}

export class UpdateSitemapGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sitemapUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PreviewSitemapDto {
  @ApiProperty({ description: 'Sitemap to parse. Defaults to the category’s own sitemap.' })
  @IsOptional()
  @IsString()
  sitemapUrl?: string;
}

export class StartGroupCrawlDto {
  @ApiPropertyOptional({ enum: CrawlMode, default: CrawlMode.Incremental })
  @IsOptional()
  @IsEnum(CrawlMode)
  mode?: CrawlMode;
}
