import { DateTime } from 'luxon';
import { OFFICE_CLOSE_HOUR, OFFICE_OPEN_HOUR, OFFICE_ZONE } from './office-hours';

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  label: string;
}

const SLOT_MINUTES = 30;
const DAYS_PER_WEEK = 7;
const SLOTS_PER_DAY = ((OFFICE_CLOSE_HOUR - OFFICE_OPEN_HOUR) * 60) / SLOT_MINUTES;

/**
 * Builds the office-day grid (7 Kyiv days × 20 half-hour slots) for the week
 * containing `weekStart` — any instant in the week works, since the Kyiv
 * Monday is derived from it via Luxon's ISO `startOf('week')`.
 *
 * `label` is recomputed from each slot's OWN `startsAt` instant in the
 * viewer's `zone`, never from one offset cached at the top of the week: a
 * week that straddles a Kyiv DST transition shifts the Kyiv-to-viewer gap
 * partway through, and reusing an earlier offset would mislabel every slot
 * past that point.
 */
export function slotsForWeek(weekStart: Date, zone: string): Slot[] {
  const kyivMonday = DateTime.fromJSDate(weekStart, { zone: 'utc' }).setZone(OFFICE_ZONE).startOf('week');

  const slots: Slot[] = [];
  for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
    const dayOpen = kyivMonday
      .plus({ days: day })
      .set({ hour: OFFICE_OPEN_HOUR, minute: 0, second: 0, millisecond: 0 });

    for (let slotIndex = 0; slotIndex < SLOTS_PER_DAY; slotIndex += 1) {
      const slotStart = dayOpen.plus({ minutes: slotIndex * SLOT_MINUTES });
      const startsAt = slotStart.toJSDate();
      const endsAt = slotStart.plus({ minutes: SLOT_MINUTES }).toJSDate();
      const label = DateTime.fromJSDate(startsAt, { zone: 'utc' }).setZone(zone).toFormat('HH:mm');

      slots.push({ startsAt, endsAt, label });
    }
  }

  return slots;
}

export function getKyivWeekParamForInstant(startsAt: Date | string): string {
  const dt =
    typeof startsAt === 'string'
      ? DateTime.fromISO(startsAt, { zone: 'utc' })
      : DateTime.fromJSDate(startsAt, { zone: 'utc' });
  return dt.setZone(OFFICE_ZONE).startOf('week').toFormat('yyyy-MM-dd');
}

