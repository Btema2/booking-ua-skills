import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  formatInstantTime,
  getBookingGridRow,
  getCurrentKyivWeek,
  getKyivWeek,
  getPrevKyivWeekParam,
  getNextKyivWeekParam,
  formatTzBannerText,
  getHourLabelsForGutter,
  getViewerZone,
} from './timeUtils';

describe('timeUtils', () => {
  describe('getCurrentKyivWeek', () => {
    it('computes current Kyiv week bounds (Monday 00:00 to Sunday 23:59:59.999 in Europe/Kyiv)', () => {
      const week = getCurrentKyivWeek();

      expect(week.daysKyiv).toHaveLength(7);
      expect(week.mondayKyiv.zoneName).toBe('Europe/Kyiv');
      expect(week.mondayKyiv.weekday).toBe(1); // Monday
      expect(week.mondayKyiv.hour).toBe(0);
      expect(week.mondayKyiv.minute).toBe(0);
      expect(week.mondayKyiv.second).toBe(0);
      expect(week.mondayKyiv.millisecond).toBe(0);

      expect(week.sundayEndKyiv.zoneName).toBe('Europe/Kyiv');
      expect(week.sundayEndKyiv.weekday).toBe(7); // Sunday
      expect(week.sundayEndKyiv.hour).toBe(23);
      expect(week.sundayEndKyiv.minute).toBe(59);
      expect(week.sundayEndKyiv.second).toBe(59);
      expect(week.sundayEndKyiv.millisecond).toBe(999);

      expect(week.weekStartISO).toBe(week.mondayKyiv.toUTC().toISO());
      expect(week.fromISO).toBe(week.weekStartISO);
      expect(week.toISO).toBe(week.sundayEndKyiv.toUTC().toISO());
    });
  });

  describe('getViewerZone', () => {
    it('returns system timezone string', () => {
      const zone = getViewerZone();
      expect(typeof zone).toBe('string');
      expect(zone.length).toBeGreaterThan(0);
    });
  });

  describe('formatInstantTime', () => {
    it('formats a UTC instant into viewer zone HH:mm', () => {
      const utcInstant = '2026-08-05T07:00:00.000Z';
      const labelKyiv = formatInstantTime(utcInstant, 'Europe/Kyiv');
      // In EEST (UTC+3), 07:00 UTC is 10:00 Kyiv
      expect(labelKyiv).toBe('10:00');
    });
  });

  describe('getHourLabelsForGutter', () => {
    it('returns 10 hour labels from 09:00 to 18:00 Kyiv converted to viewer zone', () => {
      const { daysKyiv } = getCurrentKyivWeek();
      const labels = getHourLabelsForGutter(daysKyiv, 'Europe/Kyiv');

      expect(labels).toHaveLength(10);
      expect(labels[0]).toBe('09:00');
      expect(labels[1]).toBe('10:00');
      expect(labels[9]).toBe('18:00');
    });

    it('converts Kyiv hours to specified viewer timezone (e.g. UTC)', () => {
      const { daysKyiv } = getCurrentKyivWeek();
      const labelsUTC = getHourLabelsForGutter(daysKyiv, 'UTC');

      // Summer time (EEST = UTC+3), 09:00 Kyiv is 06:00 UTC
      expect(labelsUTC[0]).toBe('06:00');
      expect(labelsUTC[9]).toBe('15:00');
    });
  });

  describe('getBookingGridRow', () => {
    it('calculates grid position for a Monday 09:00 - 10:00 booking in Kyiv time', () => {
      // 09:00 Kyiv in August (UTC+3) is 06:00 UTC
      const startsAtISO = '2026-08-03T06:00:00.000Z'; // Monday 09:00 Kyiv
      const endsAtISO = '2026-08-03T07:00:00.000Z';   // Monday 10:00 Kyiv

      const pos = getBookingGridRow(startsAtISO, endsAtISO);
      expect(pos.dayIndex).toBe(0);   // Monday
      expect(pos.startRow).toBe(1);   // 09:00 is first slot -> row 1
      expect(pos.span).toBe(2);       // 1 hour = two 30-min slots
    });

    it('calculates grid position for a Wednesday 14:30 - 16:00 booking', () => {
      const monday = DateTime.now().setZone('Europe/Kyiv').startOf('week');
      const wednesdayStart = monday.plus({ days: 2 }).set({ hour: 14, minute: 30, second: 0, millisecond: 0 });
      const wednesdayEnd = wednesdayStart.plus({ minutes: 90 });

      const startsAtISO = wednesdayStart.toUTC().toISO()!;
      const endsAtISO = wednesdayEnd.toUTC().toISO()!;

      const pos = getBookingGridRow(startsAtISO, endsAtISO);
      expect(pos.dayIndex).toBe(2); // Wednesday (weekday 3 - 1 = 2)
      // (14 - 9) * 2 + 1 = 11 slot index -> startRow 12
      expect(pos.startRow).toBe(12);
      expect(pos.span).toBe(3); // 90 min = 3 slots
    });
  });

  describe('week navigation bounds across month and year boundaries', () => {
    it('calculates prev and next week bounds across month boundaries', () => {
      const weekAug = getKyivWeek('2026-08-31');
      expect(weekAug.mondayKyiv.toFormat('yyyy-MM-dd')).toBe('2026-08-31');
      expect(weekAug.sundayEndKyiv.toFormat('yyyy-MM-dd')).toBe('2026-09-06');

      const nextWeek = getKyivWeek(getNextKyivWeekParam(weekAug.mondayKyiv));
      expect(nextWeek.mondayKyiv.toFormat('yyyy-MM-dd')).toBe('2026-09-07');

      const prevWeek = getKyivWeek(getPrevKyivWeekParam(weekAug.mondayKyiv));
      expect(prevWeek.mondayKyiv.toFormat('yyyy-MM-dd')).toBe('2026-08-24');
    });

    it('calculates prev and next week bounds across year boundaries', () => {
      const weekDec = getKyivWeek('2026-12-28');
      expect(weekDec.mondayKyiv.toFormat('yyyy-MM-dd')).toBe('2026-12-28');
      expect(weekDec.sundayEndKyiv.toFormat('yyyy-MM-dd')).toBe('2027-01-03');

      const nextWeek = getKyivWeek(getNextKyivWeekParam(weekDec.mondayKyiv));
      expect(nextWeek.mondayKyiv.toFormat('yyyy-MM-dd')).toBe('2027-01-04');
    });
  });

  describe('formatTzBannerText', () => {
    it('asserts computed offset string for Asia/Tokyo (+6), Europe/Warsaw (−1), and Europe/Kyiv', () => {
      const instant = DateTime.fromISO('2026-08-05T12:00:00Z', { zone: 'utc' });

      const tokyoBanner = formatTzBannerText('Asia/Tokyo', instant);
      expect(tokyoBanner).toBe('Час показано у вашому поясі — Asia/Tokyo, це +6 год до Києва');

      const warsawBanner = formatTzBannerText('Europe/Warsaw', instant);
      expect(warsawBanner).toBe('Час показано у вашому поясі — Europe/Warsaw, це −1 год до Києва');

      const kyivBanner = formatTzBannerText('Europe/Kyiv', instant);
      expect(kyivBanner).toBe('Київ (UTC+3)');
    });
  });

  describe('DST transition week per-instant labels', () => {
    it('computes labels per instant across a Kyiv DST transition week', () => {
      const dstWeek = getKyivWeek('2020-10-19');
      const viewerZone = 'UTC';

      const mondayInstant = dstWeek.daysKyiv[0].set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
      const mondayLabel = mondayInstant.toUTC().setZone(viewerZone).toFormat('HH:mm');
      expect(mondayLabel).toBe('06:00');

      const sundayInstant = dstWeek.daysKyiv[6].set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
      const sundayLabel = sundayInstant.toUTC().setZone(viewerZone).toFormat('HH:mm');
      expect(sundayLabel).toBe('07:00');

      expect(mondayLabel).not.toBe(sundayLabel);
    });
  });
});
