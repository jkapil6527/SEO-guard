import { BadRequestException } from '@nestjs/common';
import { assertValidTimezone, resolveCron } from './cron.util';

describe('resolveCron', () => {
  it('resolves presets to cron expressions with a computed next run', () => {
    const { cron, nextRunAt } = resolveCron({ preset: 'daily', timezone: 'Asia/Kolkata' });
    expect(cron).toBe('0 3 * * *');
    expect(nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('accepts a valid raw cron expression', () => {
    const { cron } = resolveCron({ cron: '30 2 * * 1-5', timezone: 'UTC' });
    expect(cron).toBe('30 2 * * 1-5');
  });

  it('rejects providing both preset and cron', () => {
    expect(() => resolveCron({ preset: 'daily', cron: '0 3 * * *', timezone: 'UTC' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects providing neither preset nor cron', () => {
    expect(() => resolveCron({ timezone: 'UTC' })).toThrow(BadRequestException);
  });

  it('rejects malformed cron expressions', () => {
    expect(() => resolveCron({ cron: 'not a cron', timezone: 'UTC' })).toThrow(BadRequestException);
    expect(() => resolveCron({ cron: '99 99 * * *', timezone: 'UTC' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects schedules firing more often than every 5 minutes', () => {
    expect(() => resolveCron({ cron: '* * * * *', timezone: 'UTC' })).toThrow(BadRequestException);
    expect(() => resolveCron({ cron: '*/2 * * * *', timezone: 'UTC' })).toThrow(
      BadRequestException,
    );
  });

  it('allows every-6-hours cadence', () => {
    expect(() => resolveCron({ preset: 'every_6_hours', timezone: 'UTC' })).not.toThrow();
  });
});

describe('assertValidTimezone', () => {
  it('accepts IANA timezones', () => {
    expect(() => assertValidTimezone('Asia/Kolkata')).not.toThrow();
    expect(() => assertValidTimezone('UTC')).not.toThrow();
  });

  it('rejects unknown timezones', () => {
    expect(() => assertValidTimezone('Mars/Olympus')).toThrow(BadRequestException);
  });
});
