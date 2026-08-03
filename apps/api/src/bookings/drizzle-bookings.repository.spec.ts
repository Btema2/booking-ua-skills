import { DrizzleQueryError } from 'drizzle-orm/errors';
import { EXCLUSION_VIOLATION } from '../db/driver-errors';
import { DrizzleBookingsRepository } from './drizzle-bookings.repository';
import { SlotTakenError } from './bookings.repository';

// The service spec's in-memory double raises SlotTakenError directly, so it can
// never prove that the *real* repository recognises what Postgres actually
// throws. That translation is what this file covers.
jest.mock('../db/connection', () => ({ getConnection: jest.fn() }));

const { getConnection } = jest.requireMock<{ getConnection: jest.Mock }>('../db/connection');

const NEW_BOOKING = {
  roomId: 3,
  userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  userName: 'Іван',
  title: 'Q4 planning sync',
  startsAt: new Date('2026-08-10T09:00:00.000Z'),
  endsAt: new Date('2026-08-10T10:00:00.000Z'),
};

/** Minimal stand-in for `db.insert(...).values(...).returning(...)`. */
function insertRejectingWith(cause: Error): void {
  const returning = jest.fn(() =>
    Promise.reject(
      new DrizzleQueryError(
        'insert into "bookings" ("room_id", "user_id", "title", "starts_at", "ends_at") values ($1, $2, $3, $4, $5)',
        [NEW_BOOKING.roomId, NEW_BOOKING.userId, NEW_BOOKING.title, NEW_BOOKING.startsAt, NEW_BOOKING.endsAt],
        cause,
      ),
    ),
  );
  getConnection.mockReturnValue({
    db: { insert: () => ({ values: () => ({ returning }) }) },
  });
}

describe('DrizzleBookingsRepository.createBooking', () => {
  afterEach(() => {
    getConnection.mockReset();
  });

  it('translates the bookings_no_overlap exclusion violation into SlotTakenError', async () => {
    // No `code` of its own — a bug that already bit Phase 1 (duplicate email) is a
    // double that sets `code` directly on the outer error instead of on `.cause`,
    // which passes here but fails against the real Postgres/drizzle shape.
    const cause = Object.assign(
      new Error('conflicting key value violates exclusion constraint "bookings_no_overlap"'),
      { code: EXCLUSION_VIOLATION, constraint: 'bookings_no_overlap' },
    );
    insertRejectingWith(cause);

    await expect(new DrizzleBookingsRepository().createBooking(NEW_BOOKING)).rejects.toBeInstanceOf(SlotTakenError);
  });

  it('does not mistake an unrelated SQLSTATE (foreign key violation) for a slot conflict', async () => {
    const cause = Object.assign(new Error('insert or update on table "bookings" violates foreign key constraint'), {
      code: '23503',
      constraint: 'bookings_room_id_fkey',
    });
    insertRejectingWith(cause);

    const error: Error = await new DrizzleBookingsRepository()
      .createBooking(NEW_BOOKING)
      .then(() => {
        throw new Error('createBooking was expected to reject');
      })
      .catch((caught: unknown) => caught as Error);

    expect(error).not.toBeInstanceOf(SlotTakenError);
    expect(error).toMatchObject({ operation: 'createBooking', code: '23503' });
  });
});
