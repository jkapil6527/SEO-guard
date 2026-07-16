import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerLogger } from './logger';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(new WorkerLogger());
  app.enableShutdownHooks();
  // Standalone context: processors run until the process receives a signal.
}

void bootstrap();
