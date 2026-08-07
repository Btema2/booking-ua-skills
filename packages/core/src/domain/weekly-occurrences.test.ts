import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { weeklyOccurrences } from './weekly-occurrences';

describe('weeklyOccurrences', () => {
  it('generates `count` occurrences, one week apart in UTC when no DST boundary is crossed', () => {
    const firstStart = new Date('2026-01-06T07:00:00.000Z'); // Tuesday 09:00 Kyiv, winter (+2)
    const firstEnd = new Date('2026-01-06T08:00:00.000Z');

    const result = weeklyOccurrences(firstStart, firstEnd, 3);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ startsAt: firstStart, endsAt: firstEnd });
    expect(result[1].startsAt.getTime() - result[0].startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(result[2].startsAt.getTime() - result[1].startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('keeps the Kyiv wall-clock time identical across the last-Sunday-of-March DST transition', () => {
    // 2026-03-29 is the last Sunday of March 2026 (Kyiv's spring-forward,
    // EET +2 -> EEST +3). Tuesday 2026-03-24 is the occurrence right before
    // it, so occurrence 2 of 4 (2026-03-31) lands after the transition.
    const firstStart = new Date('2026-03-24T07:00:00.000Z'); // 09:00 Kyiv (EET, +2)
    const firstEnd = new Date('2026-03-24T08:00:00.000Z'); // 10:00 Kyiv

    const result = weeklyOccurrences(firstStart, firstEnd, 4);

    for (const occurrence of result) {
      const kyivStart = DateTime.fromJSDate(occurrence.startsAt, { zone: 'utc' }).setZone('Europe/Kyiv');
      const kyivEnd = DateTime.fromJSDate(occurrence.endsAt, { zone: 'utc' }).setZone('Europe/Kyiv');
      expect(kyivStart.toFormat('HH:mm')).toBe('09:00');
      expect(kyivEnd.toFormat('HH:mm')).toBe('10:00');
    }

    // Naive `+7 days` UTC arithmetic would keep every gap at exactly 168h.
    // The gap spanning the DST transition must be 167h instead, because
    // Kyiv loses an hour that week (EET -> EEST) — proof the function
    // anchors to Kyiv wall-clock time, not to a fixed UTC offset.
    const gapsHours = result.slice(1).map((occ, i) => (occ.startsAt.getTime() - result[i].startsAt.getTime()) / (60 * 60 * 1000));
    expect(gapsHours).toContain(167);
    expect(gapsHours.every((h) => h === 168)).toBe(false);
  });

  it("returns exactly `count` occurrences for the brief's own example (8)", () => {
    const firstStart = new Date('2026-01-06T07:00:00.000Z');
    const firstEnd = new Date('2026-01-06T08:00:00.000Z');

    expect(weeklyOccurrences(firstStart, firstEnd, 8)).toHaveLength(8);
  });
});
