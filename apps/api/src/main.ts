import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  const config = app.get(ConfigService<Env, true>);
  const env = config.get('NODE_ENV', { infer: true });

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  // Authentication is removed; CORS is permissive so the dashboard (any local
  // origin) can call the API without credentials.
  app.enableCors({ origin: true });
  app.enableShutdownHooks();

  if (env !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('SEO Guardian API')
      .setDescription('Enterprise SEO monitoring platform — REST API v1 (no auth)')
      .setVersion('1.0')
      .build();
    SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(config.get('API_PORT', { infer: true }));
}

void bootstrap();
