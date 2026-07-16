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
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_1 = require("@seo-guardian/shared");
/** Object storage for uploaded CSVs (MinIO locally, S3 in production). */
let StorageService = StorageService_1 = class StorageService {
    logger = new common_1.Logger(StorageService_1.name);
    client;
    bucket;
    constructor(config) {
        const endpoint = config.get('S3_ENDPOINT', { infer: true });
        this.bucket = config.get('S3_BUCKET_UPLOADS', { infer: true });
        this.client = new client_s3_1.S3Client({
            region: config.get('S3_REGION', { infer: true }),
            ...(endpoint ? { endpoint } : {}),
            forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
            credentials: {
                accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
                secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
            },
        });
    }
    async putObject(key, body, contentType) {
        try {
            await this.client.send(new client_s3_1.PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            }));
        }
        catch (err) {
            this.logger.error({ err, key }, 'object storage write failed');
            throw new common_1.ServiceUnavailableException({
                code: shared_1.ERROR_CODES.INTERNAL,
                message: 'File storage is unavailable; try again shortly',
            });
        }
    }
    /** Best effort: a dangling object is preferable to failing the user's delete. */
    async deleteObjectSafe(key) {
        try {
            await this.client.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        }
        catch (err) {
            this.logger.warn({ err, key }, 'object storage delete failed (ignored)');
        }
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map