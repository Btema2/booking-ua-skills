import { DateTime } from 'luxon';

export const OFFICE_ZONE = 'Europe/Kyiv';
export const OFFICE_OPEN_HOUR = 9;
export const OFFICE_CLOSE_HOUR = 19;

/**
 * A booking must sit entirely inside one Kyiv office day: start at or after
 * 09:00 and end at or before 19:00, both on the same Kyiv calendar day, every
 * day of the week. Each instant is projected to Kyiv independently via Luxon
 * (never a cached offset), so this stays correct across a DST transition.
 */
export function isWithinOfficeHours(start: Date, end: Date): boolean {
  const kyivStart = DateTime.fromJSDate(start, { zone: 'utc' }).setZone(OFFICE_ZONE);
  const kyivEnd = DateTime.fromJSDate(end, { zone: 'utc' }).setZone(OFFICE_ZONE);

  if (!kyivStart.hasSame(kyivEnd, 'day')) return false;

  const officeOpen = kyivStart.set({ hour: OFFICE_OPEN_HOUR, minute: 0, second: 0, millisecond: 0 });
  const officeClose = kyivStart.set({ hour: OFFICE_CLOSE_HOUR, minute: 0, second: 0, millisecond: 0 });

  return kyivStart.toMillis() >= officeOpen.toMillis() && kyivEnd.toMillis() <= officeClose.toMillis();
}
