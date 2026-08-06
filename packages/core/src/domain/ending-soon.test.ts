import { describe, expect, it } from 'vitest';
import { shouldNotifyBookingEnding } from './ending-soon';

const ENDS_AT = new Date('2026-01-05T11:00:00Z');

describe('shouldNotifyBookingEnding', () => {
  it('does not notify when the next slot is free, even inside the window', () => {
    const now = new Date('2026-01-05T10:55:00Z'); // 5 min before end
    expect(
      shouldNotifyBookingEnding({ now, endsAt: ENDS_AT, notifyBeforeMinutes: 10, isNextSlotTaken: false }),
    ).toBe(false);
  });

  it('notifies exactly at the N-minute threshold when the next slot is taken', () => {
    const now = new Date('2026-01-05T10:50:00Z'); // exactly 10 min before end
    expect(
      shouldNotifyBookingEnding({ now, endsAt: ENDS_AT, notifyBeforeMinutes: 10, isNextSlotTaken: true }),
    ).toBe(true);
  });

  it('does not notify a full minute before the threshold is reached', () => {
    const now = new Date('2026-01-05T10:49:00Z'); // 11 min before end
    expect(
      shouldNotifyBookingEnding({ now, endsAt: ENDS_AT, notifyBeforeMinutes: 10, isNextSlotTaken: true }),
    ).toBe(false);
  });

  it('notifies one second inside the window when the next slot is taken', () => {
    const now = new Date('2026-01-05T10:50:01Z'); // 9m59s before end
    expect(
      shouldNotifyBookingEnding({ now, endsAt: ENDS_AT, notifyBeforeMinutes: 10, isNextSlotTaken: true }),
    ).toBe(true);
  });

  it('does not notify once the booking has already ended', () => {
    const now = new Date('2026-01-05T11:00:00Z'); // exactly at end
    expect(
      shouldNotifyBookingEnding({ now, endsAt: ENDS_AT, notifyBeforeMinutes: 10, isNextSlotTaken: true }),
    ).toBe(false);
  });

  it('does not notify after the booking has already ended', () => {
    const now = new Date('2026-01-05T11:05:00Z'); // 5 min after end
    expect(
      shouldNotifyBookingEnding({ now, endsAt: ENDS_AT, notifyBeforeMinutes: 10, isNextSlotTaken: true }),
    ).toBe(false);
  });

  it('respects a custom notifyBeforeMinutes value from env', () => {
    const now = new Date('2026-01-05T10:57:00Z'); // 3 min before end
    expect(
      shouldNotifyBookingEnding({ now, endsAt: ENDS_AT, notifyBeforeMinutes: 5, isNextSlotTaken: true }),
    ).toBe(true);
    expect(
      shouldNotifyBookingEnding({ now, endsAt: ENDS_AT, notifyBeforeMinutes: 2, isNextSlotTaken: true }),
    ).toBe(false);
  });
});
