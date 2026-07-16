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
var HtmlStorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlStorageService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
/**
 * Stores raw and normalized HTML bodies in object storage, keyed by content
 * hash so identical bodies dedupe. PostgreSQL keeps only the hash pointer
 * (docs/02 §3 D3).
 */
let HtmlStorageService = HtmlStorageService_1 = class HtmlStorageService {
    logger = new common_1.Logger(HtmlStorageService_1.name);
    client;
    bucket;
    constructor(config) {
        const endpoint = config.get('S3_ENDPOINT', { infer: true });
        const accessKey = config.get('S3_ACCESS_KEY', { infer: true });
        this.bucket = config.get('S3_BUCKET_HTML', { infer: true });
        // No credentials configured ⇒ storage disabled. Extracted artifacts still
        // persist in PostgreSQL; only the raw-body archive is skipped.
        if (!accessKey) {
            this.client = null;
            this.logger.warn('object storage disabled (no S3 credentials); raw HTML will not be archived');
        }
        else {
            this.client = new client_s3_1.S3Client({
                region: config.get('S3_REGION', { infer: true }),
                ...(endpoint ? { endpoint } : {}),
                forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
                maxAttempts: 2,
                credentials: {
                    accessKeyId: accessKey,
                    secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
                },
            });
        }
    }
    get enabled() {
        return this.client !== null;
    }
    key(kind, contentHashHex) {
        return `${kind}/${contentHashHex.slice(0, 2)}/${contentHashHex}.html`;
    }
    async put(kind, contentHashHex, body) {
        if (!this.client)
            return null;
        const key = this.key(kind, contentHashHex);
        await this.client.send(new client_s3_1.PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: 'text/html' }));
        return key;
    }
    async get(key) {
        if (!this.client)
            return null;
        try {
            const res = await this.client.send(new client_s3_1.GetObjectCommand({ Bucket: this.bucket, Key: key }));
            const bytes = await res.Body?.transformToByteArray();
            return bytes ? Buffer.from(bytes) : null;
        }
        catch (err) {
            this.logger.warn({ err, key }, 'html fetch from storage failed');
            return null;
        }
    }
};
exports.HtmlStorageService = HtmlStorageService;
exports.HtmlStorageService = HtmlStorageService = HtmlStorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], HtmlStorageService);
//# sourceMappingURL=html-storage.service.js.map