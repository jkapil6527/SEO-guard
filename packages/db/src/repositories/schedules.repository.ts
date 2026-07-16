import type { Database } from '../database';

export interface ScheduleRow {
  id: string;
  websiteId: string;
  cron: string;
  timezone: string;
  mode: string;
  isActive: boolean;
  nextRunAt: Date | null;
  lastFiredAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const COLS = `id, website_id AS "websiteId", cron, timezone, mode, is_active AS "isActive",
  next_run_at AS "nextRunAt", last_fired_at AS "lastFiredAt", created_by AS "createdBy",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export class SchedulesRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): Promise<ScheduleRow | null> {
    return this.db.queryOne<ScheduleRow>(`SELECT ${COLS} FROM schedules WHERE id = $1`, [id]);
  }

  listByWebsite(websiteId: string): Promise<ScheduleRow[]> {
    return this.db.query<ScheduleRow>(
      `SELECT ${COLS} FROM schedules WHERE website_id = $1 ORDER BY created_at DESC`,
      [websiteId],
    );
  }

  listAllActive(): Promise<ScheduleRow[]> {
    return this.db.query<ScheduleRow>(`SELECT ${COLS} FROM schedules WHERE is_active`);
  }

  async create(input: {
    websiteId: string;
    cron: string;
    timezone: string;
    mode: string;
    nextRunAt: Date | null;
    createdBy: string;
  }): Promise<ScheduleRow> {
    const row = await this.db.queryOne<ScheduleRow>(
      `INSERT INTO schedules (website_id, cron, timezone, mode, next_run_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLS}`,
      [input.websiteId, input.cron, input.timezone, input.mode, input.nextRunAt, input.createdBy],
    );
    if (!row) throw new Error('insert returned no row');
    return row;
  }

  update(
    id: string,
    patch: {
      cron?: string;
      timezone?: string;
      mode?: string;
      isActive?: boolean;
      nextRunAt?: Date | null;
    },
  ): Promise<ScheduleRow | null> {
    return this.db.queryOne<ScheduleRow>(
      `UPDATE schedules SET
         cron = COALESCE($2, cron),
         timezone = COALESCE($3, timezone),
         mode = COALESCE($4, mode),
         is_active = COALESCE($5, is_active),
         next_run_at = CASE WHEN $6 THEN $7 ELSE next_run_at END,
         updated_at = now()
       WHERE id = $1 RETURNING ${COLS}`,
      [
        id,
        patch.cron ?? null,
        patch.timezone ?? null,
        patch.mode ?? null,
        patch.isActive ?? null,
        patch.nextRunAt !== undefined,
        patch.nextRunAt ?? null,
      ],
    );
  }

  async markFired(id: string, nextRunAt: Date | null): Promise<void> {
    await this.db.query(
      `UPDATE schedules SET last_fired_at = now(), next_run_at = $2 WHERE id = $1`,
      [id, nextRunAt],
    );
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.query(`DELETE FROM schedules WHERE id = $1 RETURNING id`, [id]);
    return rows.length > 0;
  }

  async websiteIdOf(scheduleId: string): Promise<string | null> {
    const row = await this.db.queryOne<{ websiteId: string }>(
      `SELECT website_id AS "websiteId" FROM schedules WHERE id = $1`,
      [scheduleId],
    );
    return row?.websiteId ?? null;
  }
}
