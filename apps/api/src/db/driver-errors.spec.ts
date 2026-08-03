import { DrizzleQueryError } from 'drizzle-orm/errors';
import { EXCLUSION_VIOLATION, QueryFailedError, runQuery, UNIQUE_VIOLATION } from './driver-errors';

/**
 * Built from the real `DrizzleQueryError` class rather than a hand-rolled object,
 * so the test fails if a drizzle upgrade moves the SQLSTATE or starts putting the
 * parameters somewhere else.
 */
const BCRYPT_HASH = '$2b$12$AbCdEfGhIjKlMnOpQrStUuVwXyZ0123456789abcdefghijklmnopq';

function duplicateEmailError(): DrizzleQueryError {
  const driverError = Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
    code: UNIQUE_VIOLATION,
    constraint: 'users_email_key',
  });
  return new DrizzleQueryError(
    'insert into "users" ("name", "email", "password_hash") values ($1, $2, $3)',
    ['Іван', 'ivan@x.com', BCRYPT_HASH],
    driverError,
  );
}

const OVERLAPPING_BOOKING_TITLE = 'Q4 planning sync';

function overlappingBookingError(): DrizzleQueryError {
  const driverError = Object.assign(
    new Error('conflicting key value violates exclusion constraint "bookings_no_overlap"'),
    { code: EXCLUSION_VIOLATION, constraint: 'bookings_no_overlap' },
  );
  return new DrizzleQueryError(
    'insert into "bookings" ("room_id", "user_id", "title", "starts_at", "ends_at") values ($1, $2, $3, $4, $5)',
    [3, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', OVERLAPPING_BOOKING_TITLE, '2026-08-10T09:00:00.000Z', '2026-08-10T10:00:00.000Z'],
    driverError,
  );
}

describe('runQuery', () => {
  it('returns the query result untouched when nothing fails', async () => {
    await expect(runQuery('findUser', async () => ['row'])).resolves.toEqual(['row']);
  });

  it('reads the SQLSTATE off the wrapped cause, where drizzle actually puts it', async () => {
    // The wrapper itself has no `code`, so matching on it directly never fires
    // and a duplicate email would surface as a 500 instead of a 409.
    expect((duplicateEmailError() as unknown as { code?: string }).code).toBeUndefined();

    const failure = await runQuery('createUser', () => Promise.reject(duplicateEmailError())).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(QueryFailedError);
    expect(failure).toMatchObject({
      operation: 'createUser',
      code: UNIQUE_VIOLATION,
      constraint: 'users_email_key',
    });
  });

  it('never carries the bound parameters, which include the bcrypt hash', async () => {
    const original = duplicateEmailError();
    expect(original.message).toContain(BCRYPT_HASH);

    const failure = (await runQuery('createUser', () => Promise.reject(original)).catch(
      (error: unknown) => error,
    )) as QueryFailedError;

    for (const text of [failure.message, failure.stack ?? '', JSON.stringify(failure)]) {
      expect(text).not.toContain(BCRYPT_HASH);
      expect(text).not.toContain('ivan@x.com');
    }
    expect(failure).not.toHaveProperty('cause');
    expect(failure).not.toHaveProperty('params');
  });

  it('reads the SQLSTATE off the wrapped cause for an overlapping booking', async () => {
    // Same shape as the duplicate-email wrapper: no `code` of its own, so an
    // overlapping booking would surface as a 500 instead of a 409 without
    // walking the cause chain.
    expect((overlappingBookingError() as unknown as { code?: string }).code).toBeUndefined();

    const failure = await runQuery('createBooking', () => Promise.reject(overlappingBookingError())).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(QueryFailedError);
    expect(failure).toMatchObject({
      operation: 'createBooking',
      code: EXCLUSION_VIOLATION,
      constraint: 'bookings_no_overlap',
    });
  });

  it('never carries the bound parameters of an overlapping booking, such as its title', async () => {
    const original = overlappingBookingError();
    expect(original.message).toContain(OVERLAPPING_BOOKING_TITLE);

    const failure = (await runQuery('createBooking', () => Promise.reject(original)).catch(
      (error: unknown) => error,
    )) as QueryFailedError;

    for (const text of [failure.message, failure.stack ?? '', JSON.stringify(failure)]) {
      expect(text).not.toContain(OVERLAPPING_BOOKING_TITLE);
    }
    expect(failure).not.toHaveProperty('cause');
    expect(failure).not.toHaveProperty('params');
  });

  it('reports Node system codes such as a refused connection', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

    await expect(runQuery('createSession', () => Promise.reject(refused))).rejects.toMatchObject({
      operation: 'createSession',
      code: 'ECONNREFUSED',
    });
  });

  it('still redacts a failure that carries no code at all', async () => {
    await expect(runQuery('deleteSession', () => Promise.reject(new Error('boom')))).rejects.toMatchObject({
      operation: 'deleteSession',
      code: undefined,
      message: 'Query failed during deleteSession',
    });
  });
});
