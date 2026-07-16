"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulesRepository = void 0;
const COLS = `id, website_id AS "websiteId", cron, timezone, mode, is_active AS "isActive",
  next_run_at AS "nextRunAt", last_fired_at AS "lastFiredAt", created_by AS "createdBy",
  created_at AS "createdAt", updated_at AS "updatedAt"`;
class SchedulesRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        return this.db.queryOne(`SELECT ${COLS} FROM schedules WHERE id = $1`, [id]);
    }
    listByWebsite(websiteId) {
        return this.db.query(`SELECT ${COLS} FROM schedules WHERE website_id = $1 ORDER BY created_at DESC`, [websiteId]);
    }
    listAllActive() {
        return this.db.query(`SELECT ${COLS} FROM schedules WHERE is_active`);
    }
    async create(input) {
        const row = await this.db.queryOne(`INSERT INTO schedules (website_id, cron, timezone, mode, next_run_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLS}`, [input.websiteId, input.cron, input.timezone, input.mode, input.nextRunAt, input.createdBy]);
        if (!row)
            throw new Error('insert returned no row');
        return row;
    }
    update(id, patch) {
        return this.db.queryOne(`UPDATE schedules SET
         cron = COALESCE($2, cron),
         timezone = COALESCE($3, timezone),
         mode = COALESCE($4, mode),
         is_active = COALESCE($5, is_active),
         next_run_at = CASE WHEN $6 THEN $7 ELSE next_run_at END,
         updated_at = now()
       WHERE id = $1 RETURNING ${COLS}`, [
            id,
            patch.cron ?? null,
            patch.timezone ?? null,
            patch.mode ?? null,
            patch.isActive ?? null,
            patch.nextRunAt !== undefined,
            patch.nextRunAt ?? null,
        ]);
    }
    async markFired(id, nextRunAt) {
        await this.db.query(`UPDATE schedules SET last_fired_at = now(), next_run_at = $2 WHERE id = $1`, [id, nextRunAt]);
    }
    async delete(id) {
        const rows = await this.db.query(`DELETE FROM schedules WHERE id = $1 RETURNING id`, [id]);
        return rows.length > 0;
    }
    async websiteIdOf(scheduleId) {
        const row = await this.db.queryOne(`SELECT website_id AS "websiteId" FROM schedules WHERE id = $1`, [scheduleId]);
        return row?.websiteId ?? null;
    }
}
exports.SchedulesRepository = SchedulesRepository;
//# sourceMappingURL=schedules.repository.js.map