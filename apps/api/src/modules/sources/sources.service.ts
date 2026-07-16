import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UrlSourcesRepository, WebsitesRepository } from '@seo-guardian/db';
import type { UrlSourceConfig, UrlSourceRow } from '@seo-guardian/db';
import { AuditAction, ERROR_CODES, UrlSourceType } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CsvService, isHttpUrl } from './csv.service';
import { StorageService } from './storage.service';
import type {
  CreateDiscoverySourceDto,
  CreateManualSourceDto,
  CreateSitemapSourceDto,
} from './sources.dto';

interface ActorContext {
  actor: AuthUser;
  ip: string | null;
}

@Injectable()
export class SourcesService {
  constructor(
    private readonly sources: UrlSourcesRepository,
    private readonly websites: WebsitesRepository,
    private readonly csv: CsvService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  list(websiteId: string): Promise<UrlSourceRow[]> {
    return this.sources.listByWebsite(websiteId);
  }

  async createManual(websiteId: string, dto: CreateManualSourceDto, ctx: ActorContext) {
    const urls = [...new Set(dto.urls.map((u) => u.trim()).filter(Boolean))];
    const invalid = urls.filter((u) => !isHttpUrl(u));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `Invalid URLs: ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '…' : ''}`,
      });
    }
    return this.create(websiteId, UrlSourceType.Manual, { kind: 'manual', urls }, ctx);
  }

  async createSitemap(websiteId: string, dto: CreateSitemapSourceDto, ctx: ActorContext) {
    return this.create(
      websiteId,
      UrlSourceType.Sitemap,
      { kind: 'sitemap', sitemapUrl: dto.sitemapUrl },
      ctx,
    );
  }

  async createDiscovery(websiteId: string, dto: CreateDiscoverySourceDto, ctx: ActorContext) {
    const website = await this.websites.findById(websiteId);
    if (!website) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'website not found' });
    }
    const seeds = [...new Set(dto.seeds.map((s) => s.trim()).filter(Boolean))];
    const offOrigin = seeds.filter((s) => !isHttpUrl(s) || new URL(s).origin !== website.origin);
    if (offOrigin.length > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `Discovery seeds must be valid URLs on ${website.origin}; rejected: ${offOrigin
          .slice(0, 5)
          .join(', ')}`,
      });
    }
    return this.create(
      websiteId,
      UrlSourceType.Discovery,
      { kind: 'discovery', seeds, maxDepth: dto.maxDepth ?? 3, maxPages: dto.maxPages ?? 10_000 },
      ctx,
    );
  }

  async createFromCsv(
    websiteId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    urlColumn: string,
    ctx: ActorContext,
  ) {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'text/plain',
      'application/octet-stream',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        code: ERROR_CODES.CSV_INVALID,
        message: `Unsupported content type '${file.mimetype}'; upload a CSV file`,
      });
    }
    const result = await this.csv.validateUrlCsv(file.buffer, urlColumn);
    const objectKey = `csv-sources/${websiteId}/${randomUUID()}.csv`;
    await this.storage.putObject(objectKey, file.buffer, 'text/csv');
    return this.create(
      websiteId,
      UrlSourceType.Csv,
      {
        kind: 'csv',
        objectKey,
        originalFilename: file.originalname.slice(0, 300),
        urlColumn: result.urlColumn,
        rowCount: result.rowCount,
      },
      ctx,
    );
  }

  async setActive(sourceId: string, isActive: boolean, ctx: ActorContext): Promise<UrlSourceRow> {
    const before = await this.getById(sourceId);
    const updated = await this.sources.setActive(sourceId, isActive);
    if (!updated) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'source not found' });
    }
    await this.recordAudit(before.websiteId, AuditAction.Update, updated.id, ctx, {
      before: { isActive: before.isActive },
      after: { isActive: updated.isActive },
    });
    return updated;
  }

  async delete(sourceId: string, ctx: ActorContext): Promise<void> {
    const source = await this.getById(sourceId);
    await this.sources.delete(sourceId);
    if (source.config.kind === 'csv') {
      await this.storage.deleteObjectSafe(source.config.objectKey);
    }
    await this.recordAudit(source.websiteId, AuditAction.Delete, sourceId, ctx, {
      before: { type: source.type, config: source.config as unknown as Record<string, unknown> },
    });
  }

  private async getById(sourceId: string): Promise<UrlSourceRow> {
    const source = await this.sources.findById(sourceId);
    if (!source) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'source not found' });
    }
    return source;
  }

  private async create(
    websiteId: string,
    type: UrlSourceType,
    config: UrlSourceConfig,
    ctx: ActorContext,
  ): Promise<UrlSourceRow> {
    const source = await this.sources.create({
      websiteId,
      type,
      config,
      createdBy: ctx.actor.id,
    });
    await this.recordAudit(websiteId, AuditAction.Create, source.id, ctx, {
      after: { type, config: config as unknown as Record<string, unknown> },
    });
    return source;
  }

  private async recordAudit(
    websiteId: string,
    action: AuditAction,
    entityId: string,
    ctx: ActorContext,
    diff: { before?: Record<string, unknown>; after?: Record<string, unknown> },
  ): Promise<void> {
    const projectId = await this.websites.projectIdOf(websiteId);
    await this.audit.record({
      ...ctx,
      projectId,
      action,
      entity: 'url_source',
      entityId,
      before: diff.before ?? null,
      after: diff.after ?? null,
    });
  }
}
