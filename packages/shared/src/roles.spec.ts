import { ProjectRole } from './enums';
import { roleSatisfies } from './roles';
import { isSchedulePreset, presetToCron } from './schedules';

describe('roleSatisfies', () => {
  it('grants equal role', () => {
    expect(roleSatisfies(ProjectRole.Viewer, ProjectRole.Viewer)).toBe(true);
  });

  it('grants higher role', () => {
    expect(roleSatisfies(ProjectRole.Admin, ProjectRole.Viewer)).toBe(true);
    expect(roleSatisfies(ProjectRole.SeoManager, ProjectRole.Developer)).toBe(true);
  });

  it('denies lower role', () => {
    expect(roleSatisfies(ProjectRole.Viewer, ProjectRole.Developer)).toBe(false);
    expect(roleSatisfies(ProjectRole.Developer, ProjectRole.SeoManager)).toBe(false);
    expect(roleSatisfies(ProjectRole.SeoManager, ProjectRole.Admin)).toBe(false);
  });
});

describe('schedule presets', () => {
  it('recognizes valid presets', () => {
    expect(isSchedulePreset('daily')).toBe(true);
    expect(isSchedulePreset('every_6_hours')).toBe(true);
    expect(isSchedulePreset('yearly')).toBe(false);
  });

  it('maps presets to five-field cron expressions', () => {
    expect(presetToCron('daily')).toBe('0 3 * * *');
    expect(presetToCron('weekly').split(' ')).toHaveLength(5);
  });
});
