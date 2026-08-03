import { describe, expect, it } from 'vitest';
import { isWithinOfficeHours, OFFICE_CLOSE_HOUR, OFFICE_OPEN_HOUR, OFFICE_ZONE } from './office-hours';

describe('office window constants', () => {
  it('are named, not magic numbers scattered through the file', () => {
    expect(OFFICE_ZONE).toBe('Europe/Kyiv');
    expect(OFFICE_OPEN_HOUR).toBe(9);
    expect(OFFICE_CLOSE_HOUR).toBe(19);
  });
});

describe('isWithinOfficeHours', () => {
  it('accepts a booking starting exactly at 09:00 Kyiv (winter, UTC+2)', () => {
    // 09:00 EET = 07:00 UTC
    expect(isWithinOfficeHours(new Date('2026-01-05T07:00:00Z'), new Date('2026-01-05T08:00:00Z'))).toBe(true);
  });

  it('accepts a booking ending exactly at 19:00 Kyiv (winter, UTC+2)', () => {
    // 19:00 EET = 17:00 UTC
    expect(isWithinOfficeHours(new Date('2026-01-05T16:00:00Z'), new Date('2026-01-05T17:00:00Z'))).toBe(true);
  });

  it('rejects a booking starting one minute before 09:00 Kyiv', () => {
    // 08:59 EET = 06:59 UTC
    expect(isWithinOfficeHours(new Date('2026-01-05T06:59:00Z'), new Date('2026-01-05T07:30:00Z'))).toBe(false);
  });

  it('rejects a booking starting at 18:59 Kyiv that spills past 19:00', () => {
    // 18:59 EET = 16:59 UTC, ends 19:30 EET = 17:30 UTC
    expect(isWithinOfficeHours(new Date('2026-01-05T16:59:00Z'), new Date('2026-01-05T17:30:00Z'))).toBe(false);
  });

  it('rejects a booking that straddles two Kyiv calendar days', () => {
    // 23:30 Kyiv one day through 00:30 Kyiv the next — same span, different days.
    expect(isWithinOfficeHours(new Date('2026-01-05T21:30:00Z'), new Date('2026-01-05T22:30:00Z'))).toBe(false);
  });

  it('applies on weekends too — office hours hold every day of the week', () => {
    // 2026-01-04 is a Sunday.
    expect(isWithinOfficeHours(new Date('2026-01-04T07:00:00Z'), new Date('2026-01-04T08:00:00Z'))).toBe(true);
  });

  it('accepts a booking starting exactly at 09:00 Kyiv (summer, UTC+3)', () => {
    // 09:00 EEST = 06:00 UTC
    expect(isWithinOfficeHours(new Date('2026-07-05T06:00:00Z'), new Date('2026-07-05T07:00:00Z'))).toBe(true);
  });

  it('rejects a booking well outside office hours entirely', () => {
    expect(isWithinOfficeHours(new Date('2026-01-05T02:00:00Z'), new Date('2026-01-05T03:00:00Z'))).toBe(false);
  });
});
