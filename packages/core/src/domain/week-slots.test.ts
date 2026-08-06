import { describe, expect, it } from 'vitest';
import { getKyivWeekParamForInstant, slotsForWeek } from './week-slots';

describe('slotsForWeek', () => {
  it('produces 140 slots — 7 office days × 20 half-hour slots', () => {
    const slots = slotsForWeek(new Date('2026-01-07T12:00:00Z'), 'Europe/Kyiv'); // a Wednesday
    expect(slots).toHaveLength(140);
  });

  it('derives the same Kyiv Monday from any instant inside the week', () => {
    const midweek = slotsForWeek(new Date('2026-01-07T12:00:00Z'), 'Europe/Kyiv'); // Wednesday
    const earlyInWeek = slotsForWeek(new Date('2026-01-05T00:30:00Z'), 'Europe/Kyiv'); // just after Monday midnight UTC
    const lateInWeek = slotsForWeek(new Date('2026-01-11T21:00:00Z'), 'Europe/Kyiv'); // Sunday evening Kyiv

    expect(earlyInWeek[0].startsAt).toEqual(new Date('2026-01-05T07:00:00.000Z'));
    expect(midweek[0].startsAt).toEqual(earlyInWeek[0].startsAt);
    expect(lateInWeek[0].startsAt).toEqual(earlyInWeek[0].startsAt);
  });

  it('covers 09:00-19:00 Kyiv in 30-minute slots for the first office day', () => {
    const slots = slotsForWeek(new Date('2026-01-05T00:00:00Z'), 'Europe/Kyiv');
    const monday = slots.slice(0, 20);

    expect(monday[0].startsAt).toEqual(new Date('2026-01-05T07:00:00.000Z'));
    expect(monday[0].endsAt).toEqual(new Date('2026-01-05T07:30:00.000Z'));
    expect(monday[19].startsAt).toEqual(new Date('2026-01-05T16:30:00.000Z'));
    expect(monday[19].endsAt).toEqual(new Date('2026-01-05T17:00:00.000Z'));
  });

  it('labels a slot in the viewer zone — Kyiv 09:00 stays 09:00 for a Kyiv viewer', () => {
    const slots = slotsForWeek(new Date('2026-01-05T00:00:00Z'), 'Europe/Kyiv');
    expect(slots[0].label).toBe('09:00');
  });

  it('shifts the label for a viewer in a different, fixed-offset zone', () => {
    // 09:00 Kyiv (winter, UTC+2) is 07:00 UTC, which is 02:00 in New York (UTC-5, winter).
    const slots = slotsForWeek(new Date('2026-01-05T00:00:00Z'), 'Europe/Kyiv');
    const nySlots = slotsForWeek(new Date('2026-01-05T00:00:00Z'), 'America/New_York');
    expect(slots[0].label).toBe('09:00');
    expect(nySlots[0].label).toBe('02:00');
  });

  it(
    'recomputes each label from its own instant rather than one cached week offset, ' +
      'proven by a week where Kyiv shifts DST but the viewer zone does not',
    () => {
      // Kyiv (EU rule) springs forward on 2026-03-29 at 01:00 UTC (+2 -> +3).
      // New York already switched three weeks earlier, on 2026-03-08, so across
      // this single Kyiv week New York's offset is fixed at -4 (EDT) while
      // Kyiv's own offset changes partway through — a Kyiv-to-viewer gap
      // cached once at the top of the week would compute Sunday's slot wrong.
      const weekStart = new Date('2026-03-25T12:00:00Z'); // a Wednesday inside that Kyiv week
      const slots = slotsForWeek(weekStart, 'America/New_York');

      const mondayFirstSlot = slots[0];
      const sundayFirstSlot = slots[6 * 20];

      expect(mondayFirstSlot.startsAt).toEqual(new Date('2026-03-23T07:00:00.000Z')); // 09:00 Kyiv, still +2
      expect(mondayFirstSlot.label).toBe('03:00');

      expect(sundayFirstSlot.startsAt).toEqual(new Date('2026-03-29T06:00:00.000Z')); // 09:00 Kyiv, now +3
      expect(sundayFirstSlot.label).toBe('02:00');
    },
  );
});

describe('getKyivWeekParamForInstant', () => {
  it('returns Monday formatted as yyyy-MM-dd for 30 December dates', () => {
    expect(getKyivWeekParamForInstant('2020-12-30T10:00:00Z')).toBe('2020-12-28');
    expect(getKyivWeekParamForInstant(new Date('2025-12-30T10:00:00Z'))).toBe('2025-12-29');
  });

  it('handles a date where week starts in the previous year', () => {
    // 2020-01-01 is a Wednesday; the Monday of that week is 2019-12-30
    expect(getKyivWeekParamForInstant('2020-01-01T12:00:00Z')).toBe('2019-12-30');
  });

  it('handles a month boundary crossing', () => {
    // 2026-03-01 is a Sunday; the Monday of that week is 2026-02-23 (February)
    expect(getKyivWeekParamForInstant('2026-03-01T12:00:00Z')).toBe('2026-02-23');
    // 2026-02-01 is a Sunday; the Monday of that week is 2026-01-26 (January)
    expect(getKyivWeekParamForInstant(new Date('2026-02-01T12:00:00Z'))).toBe('2026-01-26');
  });
});

