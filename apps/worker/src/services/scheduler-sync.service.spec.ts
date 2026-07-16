import { SchedulerSyncService } from './scheduler-sync.service';
import type { ScheduleRow } from '@seo-guardian/db';

function makeSchedule(id: string, overrides: Partial<ScheduleRow> = {}): ScheduleRow {
  return {
    id,
    websiteId: `website-${id}`,
    cron: '0 3 * * *',
    timezone: 'Asia/Kolkata',
    mode: 'incremental',
    isActive: true,
    nextRunAt: null,
    lastFiredAt: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SchedulerSyncService.reconcile', () => {
  let queue: {
    upsertJobScheduler: jest.Mock;
    getJobSchedulers: jest.Mock;
    removeJobScheduler: jest.Mock;
  };
  let schedules: { listAllActive: jest.Mock };
  let service: SchedulerSyncService;

  beforeEach(() => {
    queue = {
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
      getJobSchedulers: jest.fn().mockResolvedValue([]),
      removeJobScheduler: jest.fn().mockResolvedValue(undefined),
    };
    schedules = { listAllActive: jest.fn().mockResolvedValue([]) };
    service = new SchedulerSyncService(queue as never, schedules as never);
  });

  it('creates one BullMQ job scheduler per active schedule with its cron and timezone', async () => {
    schedules.listAllActive.mockResolvedValue([
      makeSchedule('s1'),
      makeSchedule('s2', { cron: '0 */6 * * *', timezone: 'UTC' }),
    ]);

    const result = await service.reconcile();

    expect(result).toEqual({ upserted: 2, removed: 0 });
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      's1',
      { pattern: '0 3 * * *', tz: 'Asia/Kolkata' },
      expect.objectContaining({
        name: 'fire',
        data: { scheduleId: 's1', websiteId: 'website-s1' },
      }),
    );
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      's2',
      { pattern: '0 */6 * * *', tz: 'UTC' },
      expect.anything(),
    );
  });

  it('removes schedulers whose schedule was deleted or paused', async () => {
    schedules.listAllActive.mockResolvedValue([makeSchedule('kept')]);
    queue.getJobSchedulers.mockResolvedValue([
      { key: 'kept' },
      { key: 'stale-1' },
      { key: 'stale-2' },
    ]);

    const result = await service.reconcile();

    expect(result).toEqual({ upserted: 1, removed: 2 });
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('stale-1');
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('stale-2');
    expect(queue.removeJobScheduler).not.toHaveBeenCalledWith('kept');
  });

  it('is a no-op when the projection already matches', async () => {
    schedules.listAllActive.mockResolvedValue([makeSchedule('s1')]);
    queue.getJobSchedulers.mockResolvedValue([{ key: 's1' }]);

    const result = await service.reconcile();

    expect(result).toEqual({ upserted: 1, removed: 0 });
    expect(queue.removeJobScheduler).not.toHaveBeenCalled();
  });
});
