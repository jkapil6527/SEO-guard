"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@seo-guardian/db");
const shared_1 = require("@seo-guardian/shared");
const audit_service_1 = require("../audit/audit.service");
function isUniqueViolation(err) {
    return typeof err === 'object' && err !== null && err.code === '23505';
}
let ProjectsService = class ProjectsService {
    projects;
    members;
    users;
    audit;
    constructor(projects, members, users, audit) {
        this.projects = projects;
        this.members = members;
        this.users = users;
        this.audit = audit;
    }
    async listForUser(user) {
        const [projects, memberships] = await Promise.all([
            this.projects.listForUser(user.id, user.isSuperAdmin),
            this.members.listForUser(user.id),
        ]);
        const roleByProject = new Map(memberships.map((m) => [m.projectId, m.role]));
        return projects.map((p) => ({
            ...p,
            myRole: roleByProject.get(p.id) ?? (user.isSuperAdmin ? shared_1.ProjectRole.Admin : undefined),
        }));
    }
    async getById(id) {
        const project = await this.projects.findById(id);
        if (!project) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'project not found' });
        }
        return project;
    }
    async create(dto, ctx) {
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
                action: shared_1.AuditAction.Create,
                entity: 'project',
                entityId: project.id,
                after: { name: project.name, slug: project.slug },
            });
            return project;
        }
        catch (err) {
            if (isUniqueViolation(err)) {
                throw new common_1.ConflictException({
                    code: shared_1.ERROR_CODES.CONFLICT,
                    message: `A project with slug '${dto.slug}' already exists`,
                });
            }
            throw err;
        }
    }
    async update(id, dto, ctx) {
        const before = await this.getById(id);
        const updated = await this.projects.update(id, dto);
        if (!updated) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'project not found' });
        }
        await this.audit.record({
            ...ctx,
            projectId: id,
            action: shared_1.AuditAction.Update,
            entity: 'project',
            entityId: id,
            before: { name: before.name, settings: before.settings },
            after: { name: updated.name, settings: updated.settings },
        });
        return updated;
    }
    async softDelete(id, ctx) {
        const project = await this.projects.softDelete(id);
        if (!project) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'project not found' });
        }
        await this.audit.record({
            ...ctx,
            projectId: id,
            action: shared_1.AuditAction.Delete,
            entity: 'project',
            entityId: id,
            before: { name: project.name, slug: project.slug },
        });
    }
    listMembers(projectId) {
        return this.members.list(projectId);
    }
    async upsertMember(projectId, userId, role, ctx) {
        const user = await this.users.findById(userId);
        if (!user || !user.isActive) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'user not found' });
        }
        // Demoting the last admin would lock the project out of self-management.
        const existing = await this.members.findRole(projectId, userId);
        if (existing?.role === shared_1.ProjectRole.Admin && role !== shared_1.ProjectRole.Admin) {
            await this.assertNotLastAdmin(projectId);
        }
        const member = await this.members.upsert(projectId, userId, role);
        await this.audit.record({
            ...ctx,
            projectId,
            action: existing ? shared_1.AuditAction.Update : shared_1.AuditAction.Create,
            entity: 'project_member',
            entityId: userId,
            before: existing ? { role: existing.role } : null,
            after: { role },
        });
        return member;
    }
    async removeMember(projectId, userId, ctx) {
        const existing = await this.members.findRole(projectId, userId);
        if (!existing) {
            throw new common_1.NotFoundException({ code: shared_1.ERROR_CODES.NOT_FOUND, message: 'member not found' });
        }
        if (existing.role === shared_1.ProjectRole.Admin) {
            await this.assertNotLastAdmin(projectId);
        }
        await this.members.remove(projectId, userId);
        await this.audit.record({
            ...ctx,
            projectId,
            action: shared_1.AuditAction.Delete,
            entity: 'project_member',
            entityId: userId,
            before: { role: existing.role },
        });
    }
    async assertNotLastAdmin(projectId) {
        const admins = await this.members.countAdmins(projectId);
        if (admins <= 1) {
            throw new common_1.UnprocessableEntityException({
                code: shared_1.ERROR_CODES.CONFLICT,
                message: 'A project must retain at least one admin',
            });
        }
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_1.ProjectsRepository,
        db_1.ProjectMembersRepository,
        db_1.UsersRepository,
        audit_service_1.AuditService])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map