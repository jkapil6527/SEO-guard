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
exports.SchedulesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const decorators_1 = require("../../common/decorators");
const schedules_dto_1 = require("./schedules.dto");
const schedules_service_1 = require("./schedules.service");
let SchedulesController = class SchedulesController {
    schedulesService;
    constructor(schedulesService) {
        this.schedulesService = schedulesService;
    }
    async list(websiteId) {
        const data = await this.schedulesService.list(websiteId);
        return { data, meta: { nextCursor: null } };
    }
    create(websiteId, dto, actor, ip) {
        return this.schedulesService.create(websiteId, dto, { actor, ip });
    }
    update(scheduleId, dto, actor, ip) {
        return this.schedulesService.update(scheduleId, dto, { actor, ip });
    }
    async remove(scheduleId, actor, ip) {
        await this.schedulesService.delete(scheduleId, { actor, ip });
    }
};
exports.SchedulesController = SchedulesController;
__decorate([
    (0, common_1.Get)('websites/:websiteId/schedules'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.Viewer, 'website', 'websiteId'),
    (0, swagger_1.ApiOperation)({ summary: 'List crawl schedules of a website' }),
    (0, swagger_1.ApiOkResponse)({ type: [schedules_dto_1.ScheduleResponseDto] }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SchedulesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('websites/:websiteId/schedules'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'website', 'websiteId'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a crawl schedule from a preset or cron (seo manager)' }),
    (0, swagger_1.ApiOkResponse)({ type: schedules_dto_1.ScheduleResponseDto }),
    __param(0, (0, common_1.Param)('websiteId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, schedules_dto_1.CreateScheduleDto, Object, String]),
    __metadata("design:returntype", void 0)
], SchedulesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('schedules/:scheduleId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'schedule', 'scheduleId'),
    (0, swagger_1.ApiOperation)({ summary: 'Update or pause a schedule (seo manager)' }),
    (0, swagger_1.ApiOkResponse)({ type: schedules_dto_1.ScheduleResponseDto }),
    __param(0, (0, common_1.Param)('scheduleId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, schedules_dto_1.UpdateScheduleDto, Object, String]),
    __metadata("design:returntype", void 0)
], SchedulesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('schedules/:scheduleId'),
    (0, decorators_1.RequireProjectRole)(shared_1.ProjectRole.SeoManager, 'schedule', 'scheduleId'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a schedule (seo manager)' }),
    __param(0, (0, common_1.Param)('scheduleId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], SchedulesController.prototype, "remove", null);
exports.SchedulesController = SchedulesController = __decorate([
    (0, swagger_1.ApiTags)('schedules'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [schedules_service_1.SchedulesService])
], SchedulesController);
//# sourceMappingURL=schedules.controller.js.map