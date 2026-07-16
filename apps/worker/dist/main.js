"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const logger_1 = require("./logger");
const worker_module_1 = require("./worker.module");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(worker_module_1.WorkerModule, { bufferLogs: true });
    app.useLogger(new logger_1.WorkerLogger());
    app.enableShutdownHooks();
    // Standalone context: processors run until the process receives a signal.
}
void bootstrap();
//# sourceMappingURL=main.js.map