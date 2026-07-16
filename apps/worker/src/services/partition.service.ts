import { Injectable, Logger } from '@nestjs/common';
import { Database } from '@seo-guardian/db';

const PARTITIONED_TABLES = ['page_snapshots', 'page_issues', 'schema_entities', 'crawl_changes'];
const MONTHS_AHEAD = 2;

/** Keeps monthly partitions provisioned ahead of time (see docs/03-database.md §4). */
@Injectable()
export class PartitionService {
  private readonly logger = new Logger(PartitionService.name);

  constructor(private readonly db: Database) {}

  async ensurePartitions(): Promise<number> {
    let created = 0;
    for (const table of PARTITIONED_TABLES) {
      const rows = await this.db.query<{ created: number }>(
        'SELECT ensure_monthly_partitions($1::regclass, $2) AS created',
        [table, MONTHS_AHEAD],
      );
      created += rows[0]?.created ?? 0;
    }
    if (created > 0) {
      this.logger.log(`created ${created} new monthly partition(s)`);
    }
    return created;
  }
}
