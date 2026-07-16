import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProjectMembersRepository, ProjectsRepository, UsersRepository } from '@seo-guardian/db';
import type { ProjectRow } from '@seo-guardian/db';
import { AuditAction, ERROR_CODES, ProjectRole } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import type { CreateProjectDto, UpdateProjectDto } from './projects.dto';

interface ActorContext {
  actor: AuthUser;
  ip: string | null;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projects: ProjectsRepository,
    private readonly members: ProjectMembersRepository,
    private readonly users: UsersRepository,
    private readonly audit: AuditService,
  ) {}

  async listForUser(user: AuthUser) {
    const [projects, memberships] = await Promise.all([
      this.projects.listForUser(user.id, user.isSuperAdmin),
      this.members.listForUser(user.id),
    ]);
    const roleByProject = new Map(memberships.map((m) => [m.projectId, m.role]));
    return projects.map((p) => ({
      ...p,
      myRole: roleByProject.get(p.id) ?? (user.isSuperAdmin ? ProjectRole.Admin : undefined),
    }));
  }

  async getById(id: string): Promise<ProjectRow> {
    const project = await this.projects.findById(id);
    if (!project) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'project not found' });
    }
    return project;
  }

  async create(dto: CreateProjectDto, ctx: ActorContext): Promise<ProjectRow> {
    try {
      const project = await this.projects.createWithOwner({
        name: dto.name,
        slug: dto.slug,
        settings: dto.settings,
        createdBy: ctx.actor.id,
      });
      await this.audit.record({
        ...ctx,
        projectId: project.id,
        action: AuditAction.Create,
        entity: 'project',
        entityId: project.id,
        after: { name: project.name, slug: project.slug },
      });
      return project;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          code: ERROR_CODES.CONFLICT,
          message: `A project with slug '${dto.slug}' already exists`,
        });
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateProjectDto, ctx: ActorContext): Promise<ProjectRow> {
    const before = await this.getById(id);
    const updated = await this.projects.update(id, dto);
    if (!updated) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'project not found' });
    }
    await this.audit.record({
      ...ctx,
      projectId: id,
      action: AuditAction.Update,
      entity: 'project',
      entityId: id,
      before: { name: before.name, settings: before.settings },
      after: { name: updated.name, settings: updated.settings },
    });
    return updated;
  }

  async softDelete(id: string, ctx: ActorContext): Promise<void> {
    const project = await this.projects.softDelete(id);
    if (!project) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'project not found' });
    }
    await this.audit.record({
      ...ctx,
      projectId: id,
      action: AuditAction.Delete,
      entity: 'project',
      entityId: id,
      before: { name: project.name, slug: project.slug },
    });
  }

  listMembers(projectId: string) {
    return this.members.list(projectId);
  }

  async upsertMember(projectId: string, userId: string, role: ProjectRole, ctx: ActorContext) {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'user not found' });
    }
    // Demoting the last admin would lock the project out of self-management.
    const existing = await this.members.findRole(projectId, userId);
    if (existing?.role === ProjectRole.Admin && role !== ProjectRole.Admin) {
      await this.assertNotLastAdmin(projectId);
    }
    const member = await this.members.upsert(projectId, userId, role);
    await this.audit.record({
      ...ctx,
      projectId,
      action: existing ? AuditAction.Update : AuditAction.Create,
      entity: 'project_member',
      entityId: userId,
      before: existing ? { role: existing.role } : null,
      after: { role },
    });
    return member;
  }

  async removeMember(projectId: string, userId: string, ctx: ActorContext): Promise<void> {
    const existing = await this.members.findRole(projectId, userId);
    if (!existing) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'member not found' });
    }
    if (existing.role === ProjectRole.Admin) {
      await this.assertNotLastAdmin(projectId);
    }
    await this.members.remove(projectId, userId);
    await this.audit.record({
      ...ctx,
      projectId,
      action: AuditAction.Delete,
      entity: 'project_member',
      entityId: userId,
      before: { role: existing.role },
    });
  }

  private async assertNotLastAdmin(projectId: string): Promise<void> {
    const admins = await this.members.countAdmins(projectId);
    if (admins <= 1) {
      throw new UnprocessableEntityException({
        code: ERROR_CODES.CONFLICT,
        message: 'A project must retain at least one admin',
      });
    }
  }
}
