import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ERROR_CODES, ProjectRole } from '@seo-guardian/shared';
import { IsBoolean } from 'class-validator';
import { memoryStorage } from 'multer';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, RequireProjectRole } from '../../common/decorators';
import { validateDto } from '../../common/validate-dto';
import {
  CreateDiscoverySourceDto,
  CreateManualSourceDto,
  CreateSitemapSourceDto,
} from './sources.dto';
import { SourcesService } from './sources.service';

const CSV_MAX_BYTES = 20 * 1024 * 1024;

class SetActiveDto {
  @IsBoolean()
  isActive: boolean;
}

@ApiTags('sources')
@ApiBearerAuth()
@ApiExtraModels(CreateManualSourceDto, CreateSitemapSourceDto, CreateDiscoverySourceDto)
@Controller()
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get('websites/:websiteId/sources')
  @RequireProjectRole(ProjectRole.Viewer, 'website', 'websiteId')
  @ApiOperation({ summary: 'List URL sources of a website' })
  async list(@Param('websiteId', ParseUUIDPipe) websiteId: string) {
    const data = await this.sourcesService.list(websiteId);
    return { data, meta: { nextCursor: null } };
  }

  @Post('websites/:websiteId/sources')
  @RequireProjectRole(ProjectRole.SeoManager, 'website', 'websiteId')
  @ApiOperation({ summary: 'Add a manual / sitemap / discovery source (seo manager)' })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(CreateManualSourceDto) },
        { $ref: getSchemaPath(CreateSitemapSourceDto) },
        { $ref: getSchemaPath(CreateDiscoverySourceDto) },
      ],
      discriminator: { propertyName: 'type' },
    },
  })
  async create(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    const ctx = { actor, ip };
    switch (body.type) {
      case 'manual':
        return this.sourcesService.createManual(
          websiteId,
          await validateDto(CreateManualSourceDto, body),
          ctx,
        );
      case 'sitemap':
        return this.sourcesService.createSitemap(
          websiteId,
          await validateDto(CreateSitemapSourceDto, body),
          ctx,
        );
      case 'discovery':
        return this.sourcesService.createDiscovery(
          websiteId,
          await validateDto(CreateDiscoverySourceDto, body),
          ctx,
        );
      default:
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          message: "type must be one of 'manual', 'sitemap', 'discovery' (CSV uses /sources/csv)",
        });
    }
  }

  @Post('websites/:websiteId/sources/csv')
  @RequireProjectRole(ProjectRole.SeoManager, 'website', 'websiteId')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: CSV_MAX_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a URL CSV as a source (seo manager, ≤20MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        urlColumn: { type: 'string', default: 'url' },
      },
      required: ['file'],
    },
  })
  async uploadCsv(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('urlColumn') urlColumn: string | undefined,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: ERROR_CODES.CSV_INVALID,
        message: "Missing file field 'file'",
      });
    }
    return this.sourcesService.createFromCsv(websiteId, file, urlColumn?.trim() || 'url', {
      actor,
      ip,
    });
  }

  @Patch('sources/:sourceId')
  @RequireProjectRole(ProjectRole.SeoManager, 'source', 'sourceId')
  @ApiOperation({ summary: 'Enable/disable a source (seo manager)' })
  async setActive(
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.sourcesService.setActive(sourceId, dto.isActive, { actor, ip });
  }

  @Delete('sources/:sourceId')
  @RequireProjectRole(ProjectRole.SeoManager, 'source', 'sourceId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a source (seo manager)' })
  async remove(
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    await this.sourcesService.delete(sourceId, { actor, ip });
  }
}
