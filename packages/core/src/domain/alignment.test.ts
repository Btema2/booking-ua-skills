import { describe, expect, it } from 'vitest';
import { durationMinutes, isAligned } from './alignment';

describe('isAligned', () => {
  it('accepts an instant exactly on the hour', () => {
    expect(isAligned(new Date('2026-01-05T10:00:00.000Z'))).toBe(true);
  });

  it('accepts an instant on the half hour', () => {
    expect(isAligned(new Date('2026-01-05T10:30:00.000Z'))).toBe(true);
  });

  it('rejects an instant off the 30-minute grid', () => {
    expect(isAligned(new Date('2026-01-05T10:15:00.000Z'))).toBe(false);
  });

  it('rejects a non-zero second', () => {
    expect(isAligned(new Date('2026-01-05T10:00:01.000Z'))).toBe(false);
  });

  it('rejects a non-zero millisecond', () => {
    expect(isAligned(new Date('2026-01-05T10:00:00.500Z'))).toBe(false);
  });

  it('checks the raw UTC boundary — a Kyiv boundary too, since every Kyiv offset is whole hours', () => {
    // Kyiv is UTC+2 in winter: 10:00 UTC is 12:00 Kyiv, still on the grid.
    expect(isAligned(new Date('2026-01-05T10:00:00.000Z'))).toBe(true);
    // Kyiv is UTC+3 in summer: 10:00 UTC is 13:00 Kyiv, still on the grid.
    expect(isAligned(new Date('2026-07-05T10:00:00.000Z'))).toBe(true);
  });
});

describe('durationMinutes', () => {
  it('counts whole minutes between two instants', () => {
    expect(durationMinutes(new Date('2026-01-05T10:00:00Z'), new Date('2026-01-05T11:30:00Z'))).toBe(90);
  });

  it('returns zero for identical instants', () => {
    const instant = new Date('2026-01-05T10:00:00Z');
    expect(durationMinutes(instant, instant)).toBe(0);
  });

  it('returns a negative number when the second instant precedes the first', () => {
    expect(durationMinutes(new Date('2026-01-05T11:00:00Z'), new Date('2026-01-05T10:00:00Z'))).toBe(-60);
  });
});
