"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueRootModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
/**
 * Registers the shared BullMQ connection once, app-wide, so any feature module
 * can `BullModule.registerQueue(...)` as a producer. The API only ever produces
 * jobs; consumers live in apps/worker.
 */
let QueueRootModule = class QueueRootModule {
};
exports.QueueRootModule = QueueRootModule;
exports.QueueRootModule = QueueRootModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.forRootAsync({
                useFactory: (config) => {
                    const url = new URL(config.get('REDIS_URL', { infer: true }));
                    return {
                        connection: {
                            host: url.hostname,
                            port: Number(url.port || 6379),
                            ...(url.username ? { username: url.username } : {}),
                            ...(url.password ? { password: url.password } : {}),
                            db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
                            maxRetriesPerRequest: 3,
                            enableOfflineQueue: false,
                        },
                    };
                },
                inject: [config_1.ConfigService],
            }),
        ],
        exports: [bullmq_1.BullModule],
    })
], QueueRootModule);
//# sourceMappingURL=queue-root.module.js.map