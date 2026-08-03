import { durationMinutes, isAligned } from './alignment';
import { isWithinOfficeHours } from './office-hours';

export type BookingRejection = 'title' | 'alignment' | 'duration' | 'officeHours' | 'past' | 'slotTaken';

export const MIN_BOOKING_MINUTES = 30;
export const MAX_BOOKING_MINUTES = 240;

export const BOOKING_REJECTION_MESSAGES: Record<BookingRejection, string> = {
  title: 'Назва має містити від 1 до 100 символів',
  alignment: 'Час має бути кратним 30 хвилинам',
  duration: `Тривалість має бути від ${MIN_BOOKING_MINUTES} хв до ${MAX_BOOKING_MINUTES / 60} год`,
  officeHours: 'Поза робочими годинами',
  past: 'Час у минулому',
  slotTaken: 'Слот зайнятий',
};

/**
 * Checks every booking-time rule that doesn't need the database, in the order
 * a user should fix them: alignment first (a misaligned time makes duration
 * and office-hours meaningless), then duration, then office hours, then
 * "not in the past". `now` is injected rather than read via `new Date()` so
 * the function stays pure. `slotTaken` is never returned here — only
 * Postgres's EXCLUDE constraint can decide that.
 */
export function validateBookingTimes(times: { startsAt: Date; endsAt: Date }, now: Date): BookingRejection | null {
  const { startsAt, endsAt } = times;

  if (!isAligned(startsAt) || !isAligned(endsAt)) return 'alignment';

  const minutes = durationMinutes(startsAt, endsAt);
  if (minutes < MIN_BOOKING_MINUTES || minutes > MAX_BOOKING_MINUTES) return 'duration';

  if (!isWithinOfficeHours(startsAt, endsAt)) return 'officeHours';

  if (startsAt.getTime() <= now.getTime()) return 'past';

  return null;
}
