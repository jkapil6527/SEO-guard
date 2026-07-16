"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const nestjs_pino_1 = require("nestjs-pino");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: true });
    app.useLogger(app.get(nestjs_pino_1.Logger));
    app.useGlobalInterceptors(new nestjs_pino_1.LoggerErrorInterceptor());
    const config = app.get((config_1.ConfigService));
    const env = config.get('NODE_ENV', { infer: true });
    app.setGlobalPrefix('api/v1');
    app.use((0, helmet_1.default)());
    // Authentication is removed; CORS is permissive so the dashboard (any local
    // origin) can call the API without credentials.
    app.enableCors({ origin: true });
    app.enableShutdownHooks();
    if (env !== 'production') {
        const doc = new swagger_1.DocumentBuilder()
            .setTitle('SEO Guardian API')
            .setDescription('Enterprise SEO monitoring platform — REST API v1 (no auth)')
            .setVersion('1.0')
            .build();
        swagger_1.SwaggerModule.setup('api/v1/docs', app, swagger_1.SwaggerModule.createDocument(app, doc));
    }
    await app.listen(config.get('API_PORT', { infer: true }));
}
void bootstrap();
//# sourceMappingURL=main.js.map