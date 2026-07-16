import { Injectable, Logger } from '@nestjs/common';
import { AuditLogsRepository } from '@seo-guardian/db';
import type { AuditAction } from '@seo-guardian/shared';
import type { AuthUser } from '../../common/auth-user';

export interface AuditEntry {
  actor: AuthUser;
  ip: string | null;
  projectId: string | null;
  action: AuditAction | string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Records every create/update/delete. Failures are logged, never propagated:
 * an audit-log outage must not take down mutations, and the write path is
 * append-only so partial failure cannot corrupt state.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditLogs: AuditLogsRepository) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditLogs.record({
        userId: entry.actor.id,
        projectId: entry.projectId,
        action: `${entry.entity}.${entry.action}`,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before ?? null,
        after: entry.after ?? null,
        ip: entry.ip,
      });
    } catch (err) {
      this.logger.error(
        { err, entry: { ...entry, before: undefined, after: undefined } },
        'audit write failed',
      );
    }
  }
}
