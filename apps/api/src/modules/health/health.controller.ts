import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Database } from '@seo-guardian/db';
import { ERROR_CODES } from '@seo-guardian/shared';
import { Public } from '../../common/decorators';
import { JobsService } from '../jobs/jobs.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly db: Database,
    private readonly jobs: JobsService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  health() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (PostgreSQL + Redis)' })
  async ready() {
    const [database, redis] = await Promise.all([
      this.db.healthCheck().catch(() => false),
      this.jobs.pingQueues(),
    ]);
    if (!database || !redis) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.INTERNAL,
        message: `not ready: database=${database ? 'ok' : 'down'} redis=${redis ? 'ok' : 'down'}`,
      });
    }
    return { status: 'ready', database: 'ok', redis: 'ok' };
  }
}
