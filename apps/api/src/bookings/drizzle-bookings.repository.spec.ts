import { DrizzleQueryError } from 'drizzle-orm/errors';
import { EXCLUSION_VIOLATION, FOREIGN_KEY_VIOLATION } from '../db/driver-errors';
import { DrizzleBookingsRepository } from './drizzle-bookings.repository';
import { RoomNotFoundError, SlotTakenError } from './bookings.repository';

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

/**
 * Minimal stand-in for `db.insert(...).values(...).returning(...)`, plus a
 * `select` chain that resolves to no conflicts. `createBooking` runs its own
 * `listRoomBookings` pre-check before the insert (see
 * `drizzle-bookings.repository.ts`), so a `db` double that stubs only
 * `insert` never reaches the mocked rejection below — the pre-check's
 * `select` call throws "not a function" first, and that unrelated failure is
 * what a caller sees instead of the translated error this suite exists to
 * verify.
 */
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
  const orderBy = jest.fn(() => Promise.resolve([]));
  getConnection.mockReturnValue({
    db: {
      insert: () => ({ values: () => ({ returning }) }),
      select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ orderBy }) }) }) }),
    },
  });
}

/** DrizzleQueryError-wrapped rejection carrying the given SQLSTATE on `.cause`. */
function queryErrorFor(code: string): DrizzleQueryError {
  const cause = Object.assign(new Error(`simulated driver error ${code}`), { code });
  return new DrizzleQueryError(
    'insert into "bookings" ("room_id", "user_id", "title", "starts_at", "ends_at") values ($1, $2, $3, $4, $5)',
    [NEW_BOOKING.roomId, NEW_BOOKING.userId, NEW_BOOKING.title, NEW_BOOKING.startsAt, NEW_BOOKING.endsAt],
    cause,
  );
}

/**
 * Same shape as `insertRejectingWith`, but `returning` can be scripted call-by-call
 * via `mockImplementationOnce`/`mockRejectedValueOnce` so the 40P01-retry tests can
 * make the first insert attempt fail differently from the second. Returns the
 * `returning` mock so tests can assert call count and per-call behaviour.
 */
function insertWithScriptedReturning(): jest.Mock {
  const returning = jest.fn();
  const orderBy = jest.fn(() => Promise.resolve([]));
  getConnection.mockReturnValue({
    db: {
      insert: () => ({ values: () => ({ returning }) }),
      select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ orderBy }) }) }) }),
    },
  });
  return returning;
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

  it('translates a foreign key violation (a roomId that does not exist) into RoomNotFoundError', async () => {
    const cause = Object.assign(new Error('insert or update on table "bookings" violates foreign key constraint'), {
      code: FOREIGN_KEY_VIOLATION,
      constraint: 'bookings_room_id_fkey',
    });
    insertRejectingWith(cause);

    const error: Error = await new DrizzleBookingsRepository()
      .createBooking(NEW_BOOKING)
      .then(() => {
        throw new Error('createBooking was expected to reject');
      })
      .catch((caught: unknown) => caught as Error);

    expect(error).toBeInstanceOf(RoomNotFoundError);
    expect(error).not.toBeInstanceOf(SlotTakenError);
  });

  it('does not mistake an unrelated SQLSTATE for either domain error', async () => {
    // 23502 = not_null_violation — plausible on this insert, but neither of
    // the two SQLSTATEs this repository specifically translates, and not the
    // 40P01 deadlock code that triggers a retry.
    const returning = insertWithScriptedReturning();
    returning.mockRejectedValueOnce(queryErrorFor('23502'));

    const error: Error = await new DrizzleBookingsRepository()
      .createBooking(NEW_BOOKING)
      .then(() => {
        throw new Error('createBooking was expected to reject');
      })
      .catch((caught: unknown) => caught as Error);

    expect(error).not.toBeInstanceOf(SlotTakenError);
    expect(error).not.toBeInstanceOf(RoomNotFoundError);
    expect(error).toMatchObject({ operation: 'createBooking', code: '23502' });
    expect(returning).toHaveBeenCalledTimes(1);
  });

  // 40P01 = deadlock_detected: the rarer case where two concurrent inserts are
  // both still in-flight and Postgres kills one to break the cycle, distinct
  // from 23P01 which is what the loser normally gets once the winner has
  // already committed. `createBooking` retries exactly once on 40P01; whatever
  // the retry returns is final.
  it('retries once after a 40P01 deadlock and resolves with the row when the retry succeeds', async () => {
    const row = {
      id: 'booking-1',
      roomId: NEW_BOOKING.roomId,
      title: NEW_BOOKING.title,
      startsAt: NEW_BOOKING.startsAt,
      endsAt: NEW_BOOKING.endsAt,
      userId: NEW_BOOKING.userId,
      seriesId: null,
    };
    const returning = insertWithScriptedReturning();
    returning.mockRejectedValueOnce(queryErrorFor('40P01')).mockResolvedValueOnce([row]);

    const result = await new DrizzleBookingsRepository().createBooking(NEW_BOOKING);

    expect(result).toEqual({ ...row, userName: NEW_BOOKING.userName });
    expect(returning).toHaveBeenCalledTimes(2);
  });

  it('retries once after a 40P01 deadlock and rejects with SlotTakenError when the retry hits the exclusion violation', async () => {
    const returning = insertWithScriptedReturning();
    returning.mockRejectedValueOnce(queryErrorFor('40P01')).mockRejectedValueOnce(queryErrorFor(EXCLUSION_VIOLATION));

    await expect(new DrizzleBookingsRepository().createBooking(NEW_BOOKING)).rejects.toBeInstanceOf(SlotTakenError);
    expect(returning).toHaveBeenCalledTimes(2);
  });

  it('retries once after a 40P01 deadlock and rejects with RoomNotFoundError when the retry hits the FK violation', async () => {
    const returning = insertWithScriptedReturning();
    returning
      .mockRejectedValueOnce(queryErrorFor('40P01'))
      .mockRejectedValueOnce(queryErrorFor(FOREIGN_KEY_VIOLATION));

    const error: Error = await new DrizzleBookingsRepository()
      .createBooking(NEW_BOOKING)
      .then(() => {
        throw new Error('createBooking was expected to reject');
      })
      .catch((caught: unknown) => caught as Error);

    expect(error).toBeInstanceOf(RoomNotFoundError);
    expect(returning).toHaveBeenCalledTimes(2);
  });

  it('does not retry a second time when the retry itself deadlocks again, and lets the raw QueryFailedError propagate', async () => {
    const returning = insertWithScriptedReturning();
    returning.mockRejectedValueOnce(queryErrorFor('40P01')).mockRejectedValueOnce(queryErrorFor('40P01'));

    const error: Error = await new DrizzleBookingsRepository()
      .createBooking(NEW_BOOKING)
      .then(() => {
        throw new Error('createBooking was expected to reject');
      })
      .catch((caught: unknown) => caught as Error);

    expect(error).not.toBeInstanceOf(SlotTakenError);
    expect(error).not.toBeInstanceOf(RoomNotFoundError);
    expect(error).toMatchObject({ operation: 'createBooking', code: '40P01' });
    expect(returning).toHaveBeenCalledTimes(2);
  });
});

describe('DrizzleBookingsRepository series methods', () => {
  afterEach(() => {
    getConnection.mockReset();
  });

  it('createBookingSeries inserts a row scoped to the given user and returns its id', async () => {
    const returning = jest.fn(() => Promise.resolve([{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }]));
    const values = jest.fn(() => ({ returning }));
    const insert = jest.fn(() => ({ values }));
    getConnection.mockReturnValue({ db: { insert } });

    const result = await new DrizzleBookingsRepository().createBookingSeries('user-id-1');

    expect(result).toEqual({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect(values).toHaveBeenCalledWith({ userId: 'user-id-1' });
  });

  it('deleteBookingSeries deletes by id', async () => {
    const where = jest.fn(() => Promise.resolve(undefined));
    const del = jest.fn(() => ({ where }));
    getConnection.mockReturnValue({ db: { delete: del } });

    await new DrizzleBookingsRepository().deleteBookingSeries('series-id-1');

    expect(del).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it('findBookingOwnershipAndSeries returns null when the booking does not exist', async () => {
    const limit = jest.fn(() => Promise.resolve([]));
    const where = jest.fn(() => ({ limit }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    getConnection.mockReturnValue({ db: { select } });

    const result = await new DrizzleBookingsRepository().findBookingOwnershipAndSeries('missing-id');

    expect(result).toBeNull();
  });

  it('findBookingOwnershipAndSeries returns the ownership row when found', async () => {
    const row = { id: 'booking-1', userId: 'user-1', seriesId: 'series-1' };
    const limit = jest.fn(() => Promise.resolve([row]));
    const where = jest.fn(() => ({ limit }));
    const from = jest.fn(() => ({ where }));
    const select = jest.fn(() => ({ from }));
    getConnection.mockReturnValue({ db: { select } });

    const result = await new DrizzleBookingsRepository().findBookingOwnershipAndSeries('booking-1');

    expect(result).toEqual(row);
  });

  it('cancelBookingSeries stamps canceled_at on every live occurrence in the series', async () => {
    const where = jest.fn(() => Promise.resolve(undefined));
    const set = jest.fn(() => ({ where }));
    const update = jest.fn(() => ({ set }));
    getConnection.mockReturnValue({ db: { update } });

    await new DrizzleBookingsRepository().cancelBookingSeries('series-1');

    expect(update).toHaveBeenCalled();
    expect(set).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });
});
