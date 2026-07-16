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
exports.PolitenessService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@seo-guardian/shared");
const ioredis_1 = require("ioredis");
const redis_provider_1 = require("./redis.provider");
/**
 * Per-domain request-rate limiter shared across all fetch workers. A fixed
 * one-second window counter in Redis bounds requests/sec/domain regardless of
 * how many workers scale up (docs/05 §1 politeness). Returns the milliseconds a
 * caller should wait before retrying when the window is full.
 */
let PolitenessService = class PolitenessService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    /**
     * Atomically reserves a request slot for `domain`. Returns { allowed: true }
     * when under the per-second cap, else the delay in ms until the next window.
     */
    async acquire(domain, ratePerSec) {
        const windowMs = 1000;
        const now = Date.now();
        const bucket = Math.floor(now / windowMs);
        const key = `${(0, shared_1.domainRateKey)(domain)}:${bucket}`;
        const count = await this.redis.incr(key);
        if (count === 1) {
            await this.redis.pexpire(key, windowMs * 2);
        }
        if (count <= ratePerSec) {
            return { allowed: true, retryInMs: 0 };
        }
        const retryInMs = (bucket + 1) * windowMs - now;
        return { allowed: false, retryInMs: Math.max(1, retryInMs) };
    }
};
exports.PolitenessService = PolitenessService;
exports.PolitenessService = PolitenessService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_provider_1.REDIS)),
    __metadata("design:paramtypes", [ioredis_1.Redis])
], PolitenessService);
//# sourceMappingURL=politeness.service.js.map