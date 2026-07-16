import { Module } from '@nestjs/common';
import { CsvService } from './csv.service';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [SourcesController],
  providers: [SourcesService, CsvService, StorageService],
})
export class SourcesModule {}
