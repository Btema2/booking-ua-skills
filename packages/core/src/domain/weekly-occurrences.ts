import { DateTime } from 'luxon';
import { OFFICE_ZONE } from './office-hours';

/**
 * Generates `count` weekly occurrences starting from occurrence 1
 * (`firstStart`/`firstEnd`). Anchors to the Kyiv **wall-clock** time via
 * Luxon `.plus({ weeks })` in the `Europe/Kyiv` zone, then converts back to
 * UTC per occurrence — never `+7×24h` on the raw UTC instant. A series can
 * span two months, long enough to cross a Kyiv DST boundary (last Sunday of
 * March or October); naive UTC arithmetic would silently shift every
 * occurrence after the boundary by an hour of Kyiv wall-clock time.
 */
export function weeklyOccurrences(
  firstStart: Date,
  firstEnd: Date,
  count: number,
): { startsAt: Date; endsAt: Date }[] {
  const kyivStart = DateTime.fromJSDate(firstStart, { zone: 'utc' }).setZone(OFFICE_ZONE);
  const kyivEnd = DateTime.fromJSDate(firstEnd, { zone: 'utc' }).setZone(OFFICE_ZONE);

  const occurrences: { startsAt: Date; endsAt: Date }[] = [];
  for (let n = 0; n < count; n += 1) {
    occurrences.push({
      startsAt: kyivStart.plus({ weeks: n }).toUTC().toJSDate(),
      endsAt: kyivEnd.plus({ weeks: n }).toUTC().toJSDate(),
    });
  }
  return occurrences;
}
