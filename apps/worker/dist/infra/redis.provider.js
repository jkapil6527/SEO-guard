"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisProvider = exports.REDIS = void 0;
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
exports.REDIS = Symbol('REDIS');
/**
 * Shared command connection for counters, flags, dedupe sets and progress
 * publication. Closed on application shutdown by WorkerModule so the process
 * exits cleanly (no lingering handles → no --forceExit in tests).
 */
exports.redisProvider = {
    provide: exports.REDIS,
    useFactory: (config) => new ioredis_1.Redis(config.get('REDIS_URL', { infer: true }), {
        maxRetriesPerRequest: null,
        lazyConnect: false,
    }),
    inject: [config_1.ConfigService],
};
//# sourceMappingURL=redis.provider.js.map