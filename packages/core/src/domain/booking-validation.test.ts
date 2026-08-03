import { describe, expect, it } from 'vitest';
import {
  BOOKING_REJECTION_MESSAGES,
  MAX_BOOKING_MINUTES,
  MIN_BOOKING_MINUTES,
  validateBookingTimes,
} from './booking-validation';

// 09:00 Kyiv (winter, +2) on a Tuesday — itself a valid, aligned, in-hours instant,
// so it can double as the "now" for a past-vs-future comparison without any other
// rule tripping first.
const NOW = new Date('2026-01-06T07:00:00Z');

function times(startIso: string, endIso: string) {
  return { startsAt: new Date(startIso), endsAt: new Date(endIso) };
}

describe('BOOKING_REJECTION_MESSAGES', () => {
  it('uses the three messages fixed by the spec, verbatim', () => {
    expect(BOOKING_REJECTION_MESSAGES.officeHours).toBe('Поза робочими годинами');
    expect(BOOKING_REJECTION_MESSAGES.past).toBe('Час у минулому');
    expect(BOOKING_REJECTION_MESSAGES.slotTaken).toBe('Слот зайнятий');
  });

  it('gives every one of the six rejection reasons a visibly distinct message', () => {
    const messages = Object.values(BOOKING_REJECTION_MESSAGES);
    expect(messages).toHaveLength(6);
    expect(new Set(messages).size).toBe(messages.length);
  });
});

describe('validateBookingTimes', () => {
  it('accepts a well-formed future booking', () => {
    // Wednesday 09:00-10:00 Kyiv, after NOW.
    const result = validateBookingTimes(times('2026-01-07T07:00:00Z', '2026-01-07T08:00:00Z'), NOW);
    expect(result).toBeNull();
  });

  it('rejects misalignment before any other rule, even when several would fail', () => {
    // Off-grid, five minutes long, and outside office hours — alignment must win.
    const result = validateBookingTimes(times('2026-01-07T07:05:00Z', '2026-01-07T07:10:00Z'), NOW);
    expect(result).toBe('alignment');
  });

  it('rejects a start that is aligned but an end that is not', () => {
    const result = validateBookingTimes(times('2026-01-07T07:00:00Z', '2026-01-07T07:41:00Z'), NOW);
    expect(result).toBe('alignment');
  });

  it(`rejects a duration under ${MIN_BOOKING_MINUTES} minutes`, () => {
    const result = validateBookingTimes(times('2026-01-07T07:00:00Z', '2026-01-07T07:00:00Z'), NOW);
    expect(result).toBe('duration');
  });

  it(`accepts a duration of exactly ${MIN_BOOKING_MINUTES} minutes`, () => {
    const result = validateBookingTimes(times('2026-01-07T07:00:00Z', '2026-01-07T07:30:00Z'), NOW);
    expect(result).toBeNull();
  });

  it(`accepts a duration of exactly ${MAX_BOOKING_MINUTES} minutes`, () => {
    const result = validateBookingTimes(times('2026-01-07T07:00:00Z', '2026-01-07T11:00:00Z'), NOW);
    expect(result).toBeNull();
  });

  it(`rejects a duration over ${MAX_BOOKING_MINUTES} minutes`, () => {
    const result = validateBookingTimes(times('2026-01-07T07:00:00Z', '2026-01-07T11:30:00Z'), NOW);
    expect(result).toBe('duration');
  });

  it('rejects office hours only once alignment and duration already pass', () => {
    // 20:00-21:00 Kyiv Wednesday: aligned, an hour long, but after close.
    const result = validateBookingTimes(times('2026-01-07T18:00:00Z', '2026-01-07T19:00:00Z'), NOW);
    expect(result).toBe('officeHours');
  });

  it('rejects a start time in the past', () => {
    // Monday, one day before NOW.
    const result = validateBookingTimes(times('2026-01-05T07:00:00Z', '2026-01-05T08:00:00Z'), NOW);
    expect(result).toBe('past');
  });

  it('rejects a start time exactly equal to now — start must be strictly future', () => {
    const result = validateBookingTimes(times(NOW.toISOString(), '2026-01-06T07:30:00Z'), NOW);
    expect(result).toBe('past');
  });

  it('checks office hours before past, so an in-the-past-but-out-of-hours booking reports officeHours', () => {
    // 20:00 Kyiv the day before NOW: both wrong, officeHours must win per the documented order.
    const result = validateBookingTimes(times('2026-01-05T18:00:00Z', '2026-01-05T19:00:00Z'), NOW);
    expect(result).toBe('officeHours');
  });
});
