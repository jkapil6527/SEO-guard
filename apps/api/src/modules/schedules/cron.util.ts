import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES, isSchedulePreset, presetToCron } from '@seo-guardian/shared';
import { CronExpressionParser } from 'cron-parser';

/** Politeness floor: schedules may not fire more often than this. */
const MIN_INTERVAL_MS = 5 * 60 * 1000;

export function assertValidTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new BadRequestException({
      code: ERROR_CODES.INVALID_TIMEZONE,
      message: `Unknown IANA timezone: ${timezone}`,
    });
  }
}

/**
 * Resolves a preset or raw cron into a validated cron expression and computes
 * the next run. Rejects expressions firing more often than every 5 minutes.
 */
export function resolveCron(input: { preset?: string; cron?: string; timezone: string }): {
  cron: string;
  nextRunAt: Date;
} {
  const { preset, cron, timezone } = input;
  if ((preset && cron) || (!preset && !cron)) {
    throw new BadRequestException({
      code: ERROR_CODES.INVALID_CRON,
      message: "Provide exactly one of 'preset' or 'cron'",
    });
  }
  const expression = preset
    ? isSchedulePreset(preset)
      ? presetToCron(preset)
      : invalid(`Unknown preset: ${preset}`)
    : cron!;

  let interval;
  try {
    interval = CronExpressionParser.parse(expression, { tz: timezone });
  } catch (err) {
    return invalid(`Invalid cron expression '${expression}': ${(err as Error).message}`);
  }

  const first = interval.next().toDate();
  const second = interval.next().toDate();
  if (second.getTime() - first.getTime() < MIN_INTERVAL_MS) {
    return invalid(`Schedule fires too frequently (${expression}); minimum interval is 5 minutes`);
  }
  return { cron: expression, nextRunAt: first };
}

function invalid(message: string): never {
  throw new BadRequestException({ code: ERROR_CODES.INVALID_CRON, message });
}
