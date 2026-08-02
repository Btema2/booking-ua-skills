import { DrizzleQueryError } from 'drizzle-orm/errors';
import { UNIQUE_VIOLATION } from '../db/driver-errors';
import { EmailAlreadyTakenError } from './auth.repository';
import { DrizzleAuthRepository } from './drizzle-auth.repository';

// The in-memory double used by the service and controller specs raises the domain
// error directly, so it can never prove that the *real* repository recognises what
// Postgres actually throws. That translation is what this file covers.
jest.mock('../db/connection', () => ({ getConnection: jest.fn() }));

const { getConnection } = jest.requireMock<{ getConnection: jest.Mock }>('../db/connection');

const NEW_USER = { name: 'Іван', email: 'ivan@x.com', passwordHash: '$2b$12$hash' };

/** Minimal stand-in for `db.insert(...).values(...).returning(...)`. */
function insertRejectingWith(cause: Error): void {
  const returning = jest.fn(() =>
    Promise.reject(
      new DrizzleQueryError('insert into "users" ...', ['Іван', 'ivan@x.com', NEW_USER.passwordHash], cause),
    ),
  );
  getConnection.mockReturnValue({
    db: { insert: () => ({ values: () => ({ returning }) }) },
  });
}

describe('DrizzleAuthRepository.createUser', () => {
  afterEach(() => {
    getConnection.mockReset();
  });

  it('translates the users_email_key collision into EmailAlreadyTakenError', async () => {
    insertRejectingWith(
      Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
        code: UNIQUE_VIOLATION,
        constraint: 'users_email_key',
      }),
    );

    await expect(new DrizzleAuthRepository().createUser(NEW_USER)).rejects.toBeInstanceOf(EmailAlreadyTakenError);
  });

  it('does not mistake an unrelated failure for a taken email, and drops the parameters', async () => {
    insertRejectingWith(Object.assign(new Error('connection terminated'), { code: '08006' }));

    const error: Error = await new DrizzleAuthRepository()
      .createUser(NEW_USER)
      .then(() => {
        throw new Error('createUser was expected to reject');
      })
      .catch((caught: unknown) => caught as Error);

    expect(error).not.toBeInstanceOf(EmailAlreadyTakenError);
    expect(error).toMatchObject({ operation: 'createUser', code: '08006' });
    expect(error.message).not.toContain(NEW_USER.passwordHash);
  });
});
