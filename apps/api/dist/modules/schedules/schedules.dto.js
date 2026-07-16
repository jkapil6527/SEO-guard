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
exports.ScheduleResponseDto = exports.UpdateScheduleDto = exports.CreateScheduleDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@seo-guardian/shared");
const class_validator_1 = require("class-validator");
class CreateScheduleDto {
    preset;
    cron;
    timezone;
    mode;
}
exports.CreateScheduleDto = CreateScheduleDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['daily', 'every_6_hours', 'weekly', 'monthly'],
        description: 'Preset; mutually exclusive with cron',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['daily', 'every_6_hours', 'weekly', 'monthly']),
    __metadata("design:type", String)
], CreateScheduleDto.prototype, "preset", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '30 2 * * 1-5', description: 'Five-field cron expression' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateScheduleDto.prototype, "cron", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Asia/Kolkata', default: 'Asia/Kolkata' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CreateScheduleDto.prototype, "timezone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: shared_1.CrawlMode, default: shared_1.CrawlMode.Incremental }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.CrawlMode),
    __metadata("design:type", String)
], CreateScheduleDto.prototype, "mode", void 0);
class UpdateScheduleDto extends CreateScheduleDto {
    isActive;
}
exports.UpdateScheduleDto = UpdateScheduleDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateScheduleDto.prototype, "isActive", void 0);
class ScheduleResponseDto {
    id;
    websiteId;
    cron;
    timezone;
    mode;
    isActive;
    nextRunAt;
    lastFiredAt;
}
exports.ScheduleResponseDto = ScheduleResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ScheduleResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ScheduleResponseDto.prototype, "websiteId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ScheduleResponseDto.prototype, "cron", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ScheduleResponseDto.prototype, "timezone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: shared_1.CrawlMode }),
    __metadata("design:type", String)
], ScheduleResponseDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ScheduleResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], ScheduleResponseDto.prototype, "nextRunAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], ScheduleResponseDto.prototype, "lastFiredAt", void 0);
//# sourceMappingURL=schedules.dto.js.map