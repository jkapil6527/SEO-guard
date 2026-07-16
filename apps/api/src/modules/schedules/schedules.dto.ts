import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrawlMode } from '@seo-guardian/shared';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateScheduleDto {
  @ApiPropertyOptional({
    enum: ['daily', 'every_6_hours', 'weekly', 'monthly'],
    description: 'Preset; mutually exclusive with cron',
  })
  @IsOptional()
  @IsIn(['daily', 'every_6_hours', 'weekly', 'monthly'])
  preset?: 'daily' | 'every_6_hours' | 'weekly' | 'monthly';

  @ApiPropertyOptional({ example: '30 2 * * 1-5', description: 'Five-field cron expression' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cron?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', default: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ enum: CrawlMode, default: CrawlMode.Incremental })
  @IsOptional()
  @IsEnum(CrawlMode)
  mode?: CrawlMode;
}

export class UpdateScheduleDto extends CreateScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ScheduleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() websiteId: string;
  @ApiProperty() cron: string;
  @ApiProperty() timezone: string;
  @ApiProperty({ enum: CrawlMode }) mode: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ nullable: true, type: String }) nextRunAt: Date | null;
  @ApiProperty({ nullable: true, type: String }) lastFiredAt: Date | null;
}
