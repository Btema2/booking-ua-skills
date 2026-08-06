import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from '../db/driver-errors';
import { AuthService } from './auth.service';
import {
  AuthRepository,
  EmailAlreadyTakenError,
  NewSession,
  NewUser,
  SessionRow,
  UserWithPasswordRow,
  VerificationTokenRow,
} from './auth.repository';


import { SESSION_TTL_MS } from './session-cookie';



// bcrypt's exports are non-configurable, so jest.spyOn cannot wrap them; this keeps
// the real implementations and only makes `compare` observable.
jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return { ...actual, compare: jest.fn(actual.compare) };
});

const compareMock = bcrypt.compare as unknown as jest.Mock;
const USER_ID = '11111111-1111-4111-8111-111111111111';
const PASSWORD = 'correct horse';

type MockedRepository = { [K in keyof AuthRepository]: jest.Mock };

function createRepository(): MockedRepository {
  return {
    createUser: jest.fn(async (user: NewUser) => ({
      id: USER_ID,
      name: user.name,
      email: user.email,
      emailVerifiedAt: null,
    })),
    findUserByEmail: jest.fn(async () => null),
    findUserById: jest.fn(async () => ({
      id: USER_ID,
      name: 'Іван',
      email: 'ivan@x.com',
      emailVerifiedAt: null,
    })),
    createSession: jest.fn(async () => undefined),
    findSessionWithUser: jest.fn(async () => null),
    deleteSession: jest.fn(async () => undefined),
    createVerificationToken: jest.fn(async () => undefined),
    findVerificationToken: jest.fn(async () => null),
    deleteVerificationToken: jest.fn(async () => undefined),
    deleteVerificationTokensForUser: jest.fn(async () => undefined),
    markEmailVerified: jest.fn(async () => undefined),
  };
}

function createService(repository: MockedRepository): AuthService {
  return new AuthService(repository as unknown as AuthRepository);
}

function bodyOf(error: unknown): unknown {
  return (error as ConflictException).getResponse();
}

describe('AuthService', () => {
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 12);
  });

  describe('register', () => {
    it('stores a bcrypt hash at cost 12 rather than the plaintext password', async () => {
      const repository = createRepository();

      await createService(repository).register({ name: 'Іван', email: 'ivan@x.com', password: PASSWORD });

      const [stored] = repository.createUser.mock.calls[0] as [NewUser];
      expect(stored.passwordHash).not.toBe(PASSWORD);
      expect(stored.passwordHash.startsWith('$2b$12$')).toBe(true);
      await expect(bcrypt.compare(PASSWORD, stored.passwordHash)).resolves.toBe(true);
    });

    it('returns the public user and opens a 30-day session with a 32-byte base64url id', async () => {
      const repository = createRepository();

      const result = await createService(repository).register({
        name: 'Іван',
        email: 'ivan@x.com',
        password: PASSWORD,
      });

      expect(result.user).toEqual({ id: USER_ID, name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: null });
      expect(result.user).not.toHaveProperty('passwordHash');

      const [session] = repository.createSession.mock.calls[0] as [NewSession];
      expect(session.id).toBe(result.sessionId);
      expect(Buffer.from(session.id, 'base64url')).toHaveLength(32);
      expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(SESSION_TTL_MS - 5_000);
      expect(session.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(SESSION_TTL_MS);
    });

    it('creates a token and logs a URL containing no bcrypt hash and no email', async () => {
      const repository = createRepository();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

      await createService(repository).register({ name: 'Іван', email: 'ivan@x.com', password: PASSWORD });

      expect(repository.createVerificationToken).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logLine = consoleSpy.mock.calls[0][0] as string;
      expect(logLine).toMatch(/^http:\/\/localhost:3000\/verify\/[A-Za-z0-9_-]+$/);
      expect(logLine).not.toContain('ivan@x.com');
      expect(logLine).not.toContain('$2b$');

      consoleSpy.mockRestore();
    });

    it('turns a taken email into the 409 contract body without opening a session', async () => {
      const repository = createRepository();
      repository.createUser.mockRejectedValue(new EmailAlreadyTakenError());

      const error = await createService(repository)
        .register({ name: 'Іван', email: 'ivan@x.com', password: PASSWORD })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect(bodyOf(error)).toEqual({ statusCode: 409, message: 'Користувач з таким email вже існує' });
      expect(repository.createSession).not.toHaveBeenCalled();
    });

    it('rethrows database failures that are not a taken email', async () => {
      const repository = createRepository();
      repository.createUser.mockRejectedValue(new QueryFailedError('createUser', '08006'));

      await expect(
        createService(repository).register({ name: 'Іван', email: 'ivan@x.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(QueryFailedError);
    });
  });

  describe('verifyEmail', () => {
    it('verifies valid token and deletes the token', async () => {
      const repository = createRepository();
      repository.findVerificationToken.mockResolvedValue({
        token: 'valid-token',
        userId: USER_ID,
        expiresAt: new Date(Date.now() + 100_000),
      });

      await createService(repository).verifyEmail('valid-token');

      expect(repository.markEmailVerified).toHaveBeenCalledWith(USER_ID);
      expect(repository.deleteVerificationToken).toHaveBeenCalledWith('valid-token');
    });

    it('returns 400 for unknown, expired, or second use of token', async () => {
      const repository = createRepository();
      // Unknown token
      repository.findVerificationToken.mockResolvedValue(null);
      await expect(createService(repository).verifyEmail('unknown-token')).rejects.toMatchObject({
        response: { statusCode: 400, message: 'Токен підтвердження недійсний або прострочений' },
      });

      // Expired token
      repository.findVerificationToken.mockResolvedValue({
        token: 'expired-token',
        userId: USER_ID,
        expiresAt: new Date(Date.now() - 100),
      });
      await expect(createService(repository).verifyEmail('expired-token')).rejects.toMatchObject({
        response: { statusCode: 400, message: 'Токен підтвердження недійсний або прострочений' },
      });
    });

    it('treats already-verified user as success without error', async () => {
      const repository = createRepository();
      repository.findVerificationToken.mockResolvedValue({
        token: 'valid-token',
        userId: USER_ID,
        expiresAt: new Date(Date.now() + 100_000),
      });
      repository.findUserById.mockResolvedValue({
        id: USER_ID,
        name: 'Іван',
        email: 'ivan@x.com',
        emailVerifiedAt: new Date(),
      });

      await expect(createService(repository).verifyEmail('valid-token')).resolves.toBeUndefined();
      expect(repository.markEmailVerified).not.toHaveBeenCalled();
      expect(repository.deleteVerificationToken).toHaveBeenCalledWith('valid-token');
    });
  });


  describe('login', () => {
    function withUser(repository: MockedRepository): void {
      const user: UserWithPasswordRow = {
        id: USER_ID,
        name: 'Іван',
        email: 'ivan@x.com',
        emailVerifiedAt: null,
        passwordHash,
      };
      repository.findUserByEmail.mockResolvedValue(user);
    }

    it('returns the public user and a fresh session on correct credentials', async () => {
      const repository = createRepository();
      withUser(repository);

      const result = await createService(repository).login({ email: 'ivan@x.com', password: PASSWORD });

      expect(repository.findUserByEmail).toHaveBeenCalledWith('ivan@x.com');
      expect(result.user).toEqual({ id: USER_ID, name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: null });
      expect(repository.createSession).toHaveBeenCalledTimes(1);
    });

    it('rejects a wrong password with the 401 contract body', async () => {
      const repository = createRepository();
      withUser(repository);

      const error = await createService(repository)
        .login({ email: 'ivan@x.com', password: 'wrong password' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(bodyOf(error)).toEqual({ statusCode: 401, message: 'Невірний email або пароль' });
      expect(repository.createSession).not.toHaveBeenCalled();
    });

    it('answers an unknown email identically, after a real bcrypt comparison', async () => {
      const repository = createRepository();
      compareMock.mockClear();

      const error = await createService(repository)
        .login({ email: 'nobody@x.com', password: PASSWORD })
        .catch((caught: unknown) => caught);

      expect(bodyOf(error)).toEqual({ statusCode: 401, message: 'Невірний email або пароль' });
      // Compared against a cost-12 throwaway hash, so the unknown-email branch is not
      // measurably faster than the wrong-password branch.
      expect(compareMock).toHaveBeenCalledTimes(1);
      expect(String(compareMock.mock.calls[0][1])).toMatch(/^\$2b\$12\$/);
    });
  });

  describe('resolveSession', () => {
    const validSession: SessionRow = {
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      user: { id: USER_ID, name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: new Date('2026-01-02T03:04:05Z') },
    };

    it('returns the public user, serialising emailVerifiedAt as an ISO instant', async () => {
      const repository = createRepository();
      repository.findSessionWithUser.mockResolvedValue(validSession);

      await expect(createService(repository).resolveSession('abc')).resolves.toEqual({
        id: USER_ID,
        name: 'Іван',
        email: 'ivan@x.com',
        emailVerifiedAt: '2026-01-02T03:04:05.000Z',
      });
    });

    it('rejects an unknown session id', async () => {
      const repository = createRepository();

      await expect(createService(repository).resolveSession('abc')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repository.deleteSession).not.toHaveBeenCalled();
    });

    it('rejects an expired session and deletes the row', async () => {
      const repository = createRepository();
      repository.findSessionWithUser.mockResolvedValue({ ...validSession, expiresAt: new Date(Date.now() - 1) });

      await expect(createService(repository).resolveSession('abc')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repository.deleteSession).toHaveBeenCalledWith('abc');
    });
  });

  describe('resolveSessionOrNull', () => {
    const validSession: SessionRow = {
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      user: { id: USER_ID, name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: new Date('2026-01-02T03:04:05Z') },
    };

    it('returns the public user for a live session', async () => {
      const repository = createRepository();
      repository.findSessionWithUser.mockResolvedValue(validSession);

      await expect(createService(repository).resolveSessionOrNull('abc')).resolves.toEqual({
        id: USER_ID,
        name: 'Іван',
        email: 'ivan@x.com',
        emailVerifiedAt: '2026-01-02T03:04:05.000Z',
      });
    });

    it('resolves to null for an unknown session id, without throwing', async () => {
      const repository = createRepository();

      await expect(createService(repository).resolveSessionOrNull('abc')).resolves.toBeNull();
      expect(repository.deleteSession).not.toHaveBeenCalled();
    });

    it('resolves to null for an expired session and deletes the row', async () => {
      const repository = createRepository();
      repository.findSessionWithUser.mockResolvedValue({ ...validSession, expiresAt: new Date(Date.now() - 1) });

      await expect(createService(repository).resolveSessionOrNull('abc')).resolves.toBeNull();
      expect(repository.deleteSession).toHaveBeenCalledWith('abc');
    });
  });

  describe('logout', () => {
    it('deletes the session when a cookie was sent', async () => {
      const repository = createRepository();
      await createService(repository).logout('abc');
      expect(repository.deleteSession).toHaveBeenCalledWith('abc');
    });

    it('is a no-op when no cookie was sent', async () => {
      const repository = createRepository();
      await expect(createService(repository).logout(undefined)).resolves.toBeUndefined();
      expect(repository.deleteSession).not.toHaveBeenCalled();
    });
  });
});
