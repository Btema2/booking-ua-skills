import { describe, expect, it } from 'vitest';
import { BOOKING_REJECTION_MESSAGES } from '../domain/booking-validation';
import { BookingSchema, CreateBookingSchema, MyBookingsQuerySchema, RoomBookingsQuerySchema, RoomIdPathSchema } from './booking';

function messagesFor(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]));
}

describe('CreateBookingSchema', () => {
  it('parses a valid payload with ISO string instants, as sent over HTTP', () => {
    const parsed = CreateBookingSchema.parse({
      roomId: 1,
      title: 'Синхронізація команди',
      startsAt: '2026-01-07T07:00:00.000Z',
      endsAt: '2026-01-07T08:00:00.000Z',
    });

    expect(parsed.startsAt).toBeInstanceOf(Date);
    expect(parsed.endsAt).toBeInstanceOf(Date);
    expect(parsed.startsAt).toEqual(new Date('2026-01-07T07:00:00.000Z'));
  });

  it('parses a valid payload with Date instances, as react-hook-form already produces', () => {
    const startsAt = new Date('2026-01-07T07:00:00.000Z');
    const endsAt = new Date('2026-01-07T08:00:00.000Z');

    const parsed = CreateBookingSchema.parse({ roomId: 1, title: 'Нарада', startsAt, endsAt });

    expect(parsed.startsAt).toEqual(startsAt);
    expect(parsed.endsAt).toEqual(endsAt);
  });

  it('trims the title', () => {
    const parsed = CreateBookingSchema.parse({
      roomId: 1,
      title: '  Планування  ',
      startsAt: '2026-01-07T07:00:00.000Z',
      endsAt: '2026-01-07T08:00:00.000Z',
    });

    expect(parsed.title).toBe('Планування');
  });

  it('rejects an empty title with the shared title message', () => {
    const result = CreateBookingSchema.safeParse({
      roomId: 1,
      title: '',
      startsAt: '2026-01-07T07:00:00.000Z',
      endsAt: '2026-01-07T08:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(messagesFor(result).title).toBe(BOOKING_REJECTION_MESSAGES.title);
  });

  it('rejects a title over 100 characters with the shared title message', () => {
    const result = CreateBookingSchema.safeParse({
      roomId: 1,
      title: 'а'.repeat(101),
      startsAt: '2026-01-07T07:00:00.000Z',
      endsAt: '2026-01-07T08:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(messagesFor(result).title).toBe(BOOKING_REJECTION_MESSAGES.title);
  });

  it('accepts a title at exactly 100 characters', () => {
    const result = CreateBookingSchema.safeParse({
      roomId: 1,
      title: 'а'.repeat(100),
      startsAt: '2026-01-07T07:00:00.000Z',
      endsAt: '2026-01-07T08:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non-ISO startsAt with a clear Ukrainian message', () => {
    const result = CreateBookingSchema.safeParse({
      roomId: 1,
      title: 'Нарада',
      startsAt: 'not-a-date',
      endsAt: '2026-01-07T08:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(messagesFor(result).startsAt).toMatch(/дата/i);
  });

  it('rejects a roomId that is not a positive integer', () => {
    expect(
      CreateBookingSchema.safeParse({
        roomId: 0,
        title: 'Нарада',
        startsAt: '2026-01-07T07:00:00.000Z',
        endsAt: '2026-01-07T08:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  // Past the int4 ceiling Postgres raises 22003 in the driver, so this has to
  // fail in validation to stay a 400 rather than becoming a 500.
  it('rejects a roomId beyond the Postgres int4 ceiling, in Ukrainian', () => {
    const result = CreateBookingSchema.safeParse({
      roomId: 3_000_000_000,
      title: 'Нарада',
      startsAt: '2026-01-07T07:00:00.000Z',
      endsAt: '2026-01-07T08:00:00.000Z',
    });

    expect(result.success).toBe(false);
    // Zod's own ceiling message is English and would otherwise reach the user.
    expect(messagesFor(result).roomId).toBe('Некоректна кімната');
  });

  // The path variant coerces first, so a non-numeric segment must still fail
  // with the Ukrainian message rather than Zod's English coercion default.
  it.each([
    ['abc', 'a non-numeric path segment'],
    ['3000000000', 'a path segment past the int4 ceiling'],
    ['0', 'a non-positive path segment'],
  ])('rejects %s in a room path — %s', (segment) => {
    const result = RoomIdPathSchema.safeParse(segment);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Некоректна кімната');
  });

  it('coerces a well-formed room path segment to a number', () => {
    expect(RoomIdPathSchema.parse('4')).toBe(4);
  });

  describe('offset requirement on string instants', () => {
    // Per ECMAScript, an offset-less date-time string parses in the host's
    // local time zone rather than UTC — so the schema requires a trailing
    // `Z` or `±HH:MM` and rejects everything else, including a bare date.
    function withStartsAt(startsAt: unknown) {
      return CreateBookingSchema.safeParse({ roomId: 1, title: 'Нарада', startsAt, endsAt: '2026-01-07T08:00:00.000Z' });
    }

    it('accepts a trailing Z', () => {
      const result = withStartsAt('2026-08-10T10:00:00Z');
      expect(result.success).toBe(true);
    });

    it('accepts an explicit +03:00 offset', () => {
      const result = withStartsAt('2026-08-10T10:00:00+03:00');
      expect(result.success).toBe(true);
    });

    // Seconds are optional in ISO 8601, so both of these are well-formed
    // instants that a client may legitimately send.
    it.each(['2026-08-10T10:00Z', '2026-08-10T10:00+03:00'])('accepts %s, which omits seconds', (startsAt) => {
      expect(withStartsAt(startsAt).success).toBe(true);
    });

    it('resolves an offset instant to the same moment as its UTC equivalent', () => {
      const offset = withStartsAt('2026-08-10T13:00:00+03:00');
      const utc = withStartsAt('2026-08-10T10:00:00Z');

      expect(offset.success && utc.success).toBe(true);
      expect(offset.data?.startsAt.getTime()).toBe(utc.data?.startsAt.getTime());
    });

    it('rejects a naive datetime string with no offset', () => {
      const result = withStartsAt('2026-08-10T10:00:00');
      expect(result.success).toBe(false);
      expect(messagesFor(result).startsAt).toMatch(/дата/i);
    });

    it('rejects a date-only string', () => {
      const result = withStartsAt('2026-08-10');
      expect(result.success).toBe(false);
      expect(messagesFor(result).startsAt).toMatch(/дата/i);
    });

    it('rejects a garbage string', () => {
      const result = withStartsAt('not-a-date');
      expect(result.success).toBe(false);
      expect(messagesFor(result).startsAt).toMatch(/дата/i);
    });

    it('still accepts a real Date object, as react-hook-form supplies', () => {
      const startsAt = new Date('2026-08-10T10:00:00Z');
      const result = withStartsAt(startsAt);
      expect(result.success).toBe(true);
    });
  });

  it('does NOT check alignment, duration, office hours, or past-ness — that is validateBookingTimes', () => {
    // Misaligned, 5 minutes long, outside office hours, and in the past — all pass here.
    const result = CreateBookingSchema.safeParse({
      roomId: 1,
      title: 'Будь-що',
      startsAt: '2020-01-01T00:05:00.000Z',
      endsAt: '2020-01-01T00:10:00.000Z',
    });

    expect(result.success).toBe(true);
  });
});

describe('RoomBookingsQuerySchema', () => {
  it('parses a valid from/to range', () => {
    const parsed = RoomBookingsQuerySchema.parse({
      from: '2026-01-05T00:00:00.000Z',
      to: '2026-01-12T00:00:00.000Z',
    });

    expect(parsed.from).toEqual(new Date('2026-01-05T00:00:00.000Z'));
    expect(parsed.to).toEqual(new Date('2026-01-12T00:00:00.000Z'));
  });

  it('rejects a "to" that is not after "from"', () => {
    const result = RoomBookingsQuerySchema.safeParse({
      from: '2026-01-12T00:00:00.000Z',
      to: '2026-01-05T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(messagesFor(result).to).toBeTruthy();
  });

  it('rejects an equal "from" and "to"', () => {
    const result = RoomBookingsQuerySchema.safeParse({
      from: '2026-01-05T00:00:00.000Z',
      to: '2026-01-05T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('requires both from and to', () => {
    expect(RoomBookingsQuerySchema.safeParse({ from: '2026-01-05T00:00:00.000Z' }).success).toBe(false);
    expect(RoomBookingsQuerySchema.safeParse({ to: '2026-01-05T00:00:00.000Z' }).success).toBe(false);
  });
});

describe('BookingSchema', () => {
  it('parses what the API returns for one booking', () => {
    const payload = {
      id: '3f7b1c2e-4b2a-4c1a-9e2a-8a2b1c3d4e5f',
      roomId: 1,
      title: 'Нарада',
      startsAt: new Date('2026-01-07T07:00:00.000Z'),
      endsAt: new Date('2026-01-07T08:00:00.000Z'),
      userId: '1a2b3c4d-5e6f-4789-8a9b-0c1d2e3f4a5b',
      userName: 'Іван Петренко',
    };

    expect(BookingSchema.parse(payload)).toEqual(payload);
  });

  it('rejects a non-uuid id', () => {
    expect(
      BookingSchema.safeParse({
        id: 'not-a-uuid',
        roomId: 1,
        title: 'Нарада',
        startsAt: new Date(),
        endsAt: new Date(),
        userId: '1a2b3c4d-5e6f-4789-8a9b-0c1d2e3f4a5b',
        userName: 'Іван',
      }).success,
    ).toBe(false);
  });
});

describe('MyBookingsQuerySchema', () => {
  it('parses valid status upcoming with default page and limit', () => {
    const parsed = MyBookingsQuerySchema.parse({ status: 'upcoming' });
    expect(parsed).toEqual({ status: 'upcoming', page: 1, limit: 10 });
  });

  it('parses valid status past with coerced page and limit', () => {
    const parsed = MyBookingsQuerySchema.parse({ status: 'past', page: '2', limit: '20' });
    expect(parsed).toEqual({ status: 'past', page: 2, limit: 20 });
  });

  it('rejects invalid status with Ukrainian error message', () => {
    const result = MyBookingsQuerySchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
    expect(messagesFor(result).status).toBe('Некоректний статус');
  });

  it('rejects missing status with Ukrainian error message', () => {
    const result = MyBookingsQuerySchema.safeParse({});
    expect(result.success).toBe(false);
    expect(messagesFor(result).status).toBe('Некоректний статус');
  });

  it('rejects non-positive or invalid page with Ukrainian error message', () => {
    const resultZero = MyBookingsQuerySchema.safeParse({ status: 'upcoming', page: 0 });
    expect(resultZero.success).toBe(false);
    expect(messagesFor(resultZero).page).toBe('Некоректна сторінка');

    const resultNeg = MyBookingsQuerySchema.safeParse({ status: 'upcoming', page: -1 });
    expect(resultNeg.success).toBe(false);
    expect(messagesFor(resultNeg).page).toBe('Некоректна сторінка');

    const resultInvalid = MyBookingsQuerySchema.safeParse({ status: 'upcoming', page: 'abc' });
    expect(resultInvalid.success).toBe(false);
    expect(messagesFor(resultInvalid).page).toBe('Некоректна сторінка');
  });

  it('rejects invalid limit values', () => {
    const resultOverMax = MyBookingsQuerySchema.safeParse({ status: 'upcoming', limit: 101 });
    expect(resultOverMax.success).toBe(false);

    const resultZero = MyBookingsQuerySchema.safeParse({ status: 'upcoming', limit: 0 });
    expect(resultZero.success).toBe(false);
  });
});

