import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { WebsitesRepository } from '@seo-guardian/db';
import type { WebsiteRow } from '@seo-guardian/db';
import { AuditAction, ERROR_CODES } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { normalizeOrigin } from './websites.dto';
import type { CreateWebsiteDto, UpdateWebsiteDto } from './websites.dto';

interface ActorContext {
  actor: AuthUser;
  ip: string | null;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

@Injectable()
export class WebsitesService {
  constructor(
    private readonly websites: WebsitesRepository,
    private readonly audit: AuditService,
  ) {}

  list(projectId: string): Promise<WebsiteRow[]> {
    return this.websites.listByProject(projectId);
  }

  async getById(id: string): Promise<WebsiteRow> {
    const website = await this.websites.findById(id);
    if (!website) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'website not found' });
    }
    return website;
  }

  async create(projectId: string, dto: CreateWebsiteDto, ctx: ActorContext): Promise<WebsiteRow> {
    const origin = normalizeOrigin(dto.origin);
    try {
      const website = await this.websites.create({
        projectId,
        name: dto.name,
        origin,
        pathScope: dto.pathScope,
        settings: dto.settings,
      });
      await this.audit.record({
        ...ctx,
        projectId,
        action: AuditAction.Create,
        entity: 'website',
        entityId: website.id,
        after: { name: website.name, origin: website.origin, pathScope: website.pathScope },
      });
      return website;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          code: ERROR_CODES.CONFLICT,
          message: `Website ${origin}${dto.pathScope ?? '/'} already exists in this project`,
        });
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateWebsiteDto, ctx: ActorContext): Promise<WebsiteRow> {
    const before = await this.getById(id);
    const updated = await this.websites.update(id, dto);
    if (!updated) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'website not found' });
    }
    await this.audit.record({
      ...ctx,
      projectId: before.projectId,
      action: AuditAction.Update,
      entity: 'website',
      entityId: id,
      before: { name: before.name, isActive: before.isActive, settings: before.settings },
      after: { name: updated.name, isActive: updated.isActive, settings: updated.settings },
    });
    return updated;
  }

  async delete(id: string, ctx: ActorContext): Promise<void> {
    const website = await this.getById(id);
    await this.websites.delete(id);
    await this.audit.record({
      ...ctx,
      projectId: website.projectId,
      action: AuditAction.Delete,
      entity: 'website',
      entityId: id,
      before: { name: website.name, origin: website.origin },
    });
  }
}
