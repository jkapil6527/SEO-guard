import { Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Database } from '@seo-guardian/db';
import { AppModule } from '../src/app.module';
import { JobsModule } from '../src/modules/jobs/jobs.module';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { StorageService } from '../src/modules/sources/storage.service';

/** Redis-free JobsService: platform integration tests target HTTP+PostgreSQL behavior. */
class FakeJobsService {
  reconcileRequests = 0;

  async requestScheduleReconcile(): Promise<void> {
    this.reconcileRequests += 1;
  }

  async pingQueues(): Promise<boolean> {
    return true;
  }
}

@Module({
  providers: [{ provide: JobsService, useClass: FakeJobsService }],
  exports: [JobsService],
})
class FakeJobsModule {}

/** In-memory object storage so CSV upload runs end-to-end without MinIO. */
class FakeStorageService {
  objects = new Map<string, Buffer>();

  async putObject(key: string, body: Buffer): Promise<void> {
    this.objects.set(key, body);
  }

  async deleteObjectSafe(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

export interface TestApp {
  app: INestApplication;
  db: Database;
  storage: FakeStorageService;
  close(): Promise<void>;
}

/** Boots the real API (authentication removed) for integration tests. */
export async function createTestApp(): Promise<TestApp> {
  const storage = new FakeStorageService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(JobsModule)
    .useModule(FakeJobsModule)
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  await app.init();

  const db = app.get(Database);

  return {
    app,
    db,
    storage,
    async close() {
      await app.close();
    },
  };
}
