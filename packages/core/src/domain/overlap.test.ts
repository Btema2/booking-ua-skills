import { describe, expect, it } from 'vitest';
import { overlaps, type BookingInterval } from './overlap';

function interval(roomId: number, startIso: string, endIso: string): BookingInterval {
  return { roomId, startsAt: new Date(startIso), endsAt: new Date(endIso) };
}

describe('overlaps', () => {
  it('back-to-back bookings (10:00-11:00 vs 11:00-12:00) do not conflict', () => {
    const a = interval(1, '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z');
    const b = interval(1, '2026-01-05T11:00:00Z', '2026-01-05T12:00:00Z');

    expect(overlaps(a, b)).toBe(false);
  });

  it('a partial overlap conflicts', () => {
    const a = interval(1, '2026-01-05T10:00:00Z', '2026-01-05T11:30:00Z');
    const b = interval(1, '2026-01-05T11:00:00Z', '2026-01-05T12:00:00Z');

    expect(overlaps(a, b)).toBe(true);
  });

  it('the exact same interval conflicts', () => {
    const a = interval(1, '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z');
    const b = interval(1, '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z');

    expect(overlaps(a, b)).toBe(true);
  });

  it('one interval fully containing the other conflicts', () => {
    const outer = interval(1, '2026-01-05T09:00:00Z', '2026-01-05T13:00:00Z');
    const inner = interval(1, '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z');

    expect(overlaps(outer, inner)).toBe(true);
  });

  it('adjacent days at the day boundary do not conflict', () => {
    const a = interval(1, '2026-01-05T23:30:00Z', '2026-01-06T00:00:00Z');
    const b = interval(1, '2026-01-06T00:00:00Z', '2026-01-06T00:30:00Z');

    expect(overlaps(a, b)).toBe(false);
  });

  it('the same time in a different room does not conflict', () => {
    const a = interval(1, '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z');
    const b = interval(2, '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z');

    expect(overlaps(a, b)).toBe(false);
  });

  it('is symmetric — argument order must not change the verdict', () => {
    const a = interval(1, '2026-01-05T10:00:00Z', '2026-01-05T11:30:00Z');
    const b = interval(1, '2026-01-05T11:00:00Z', '2026-01-05T12:00:00Z');

    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });
});
