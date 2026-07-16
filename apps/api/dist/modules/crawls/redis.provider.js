"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlRedisSubProvider = exports.crawlRedisProvider = exports.CRAWL_REDIS_SUB = exports.CRAWL_REDIS = void 0;
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
exports.CRAWL_REDIS = Symbol('CRAWL_REDIS');
exports.CRAWL_REDIS_SUB = Symbol('CRAWL_REDIS_SUB');
function connect(config) {
    return new ioredis_1.Redis(config.get('REDIS_URL', { infer: true }), { maxRetriesPerRequest: 3 });
}
exports.crawlRedisProvider = {
    provide: exports.CRAWL_REDIS,
    useFactory: connect,
    inject: [config_1.ConfigService],
};
/** Dedicated connection for SSE pub/sub subscription. */
exports.crawlRedisSubProvider = {
    provide: exports.CRAWL_REDIS_SUB,
    useFactory: connect,
    inject: [config_1.ConfigService],
};
//# sourceMappingURL=redis.provider.js.map