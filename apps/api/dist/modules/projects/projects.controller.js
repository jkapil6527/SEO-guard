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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const decorators_1 = require("../../common/decorators");
const projects_dto_1 = require("./projects.dto");
const projects_service_1 = require("./projects.service");
let ProjectsController = class ProjectsController {
    projectsService;
    constructor(projectsService) {
        this.projectsService = projectsService;
    }
    async list(user) {
        const data = await this.projectsService.listForUser(user);
        return { data, meta: { nextCursor: null } };
    }
    create(dto, actor, ip) {
        return this.projectsService.create(dto, { actor, ip });
    }
    get(projectId) {
        return this.projectsService.getById(projectId);
    }
    update(projectId, dto, actor, ip) {
        return this.projectsService.update(projectId, dto, { actor, ip });
    }
    async remove(projectId, actor, ip) {
        await this.projectsService.softDelete(projectId, { actor, ip });
    }
    async members(projectId) {
        const data = await this.projectsService.listMembers(projectId);
        return { data, meta: { nextCursor: null } };
    }
    upsertMember(projectId, userId, dto, actor, ip) {
        return this.projectsService.upsertMember(projectId, userId, dto.role, { actor, ip });
    }
    async removeMember(projectId, userId, actor, ip) {
        await this.projectsService.removeMember(projectId, userId, { actor, ip });
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Projects visible to the current user' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.SuperAdminOnly)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a project (super admin); creator becomes project admin' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [projects_dto_1.CreateProjectDto, Object, String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':projectId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'project', 'projectId'),
    (0, swagger_1.ApiOperation)({ summary: 'Project detail' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':projectId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Admin, 'project', 'projectId'),
    (0, swagger_1.ApiOperation)({ summary: 'Update project name/settings (admin)' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, projects_dto_1.UpdateProjectDto, Object, String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':projectId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Admin, 'project', 'projectId'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a project (admin)' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':projectId/members'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'project', 'projectId'),
    (0, swagger_1.ApiOperation)({ summary: 'List project members' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "members", null);
__decorate([
    (0, common_1.Put)(':projectId/members/:userId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Admin, 'project', 'projectId'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a member or change their role (admin)' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, decorators_1.CurrentUser)()),
    __param(4, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, projects_dto_1.UpsertMemberDto, Object, String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "upsertMember", null);
__decorate([
    (0, common_1.Delete)(':projectId/members/:userId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Admin, 'project', 'projectId'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiOperation)({ summary: 'Remove a member (admin)' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "removeMember", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, swagger_1.ApiTags)('projects'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('projects'),
    __metadata("design:paramtypes", [projects_service_1.ProjectsService])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map