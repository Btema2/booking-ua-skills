import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthRepository, SessionRow } from './auth.repository';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './authenticated-request';
import { SESSION_TTL_MS } from './session-cookie';

const USER = { id: '11111111-1111-4111-8111-111111111111', name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: null };

type MockedRepository = { [K in keyof AuthRepository]: jest.Mock };

function createRepository(session: SessionRow | null): MockedRepository {
  return {
    createUser: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createSession: jest.fn(),
    findSessionWithUser: jest.fn(async () => session),
    deleteSession: jest.fn(async () => undefined),
    createVerificationToken: jest.fn(),
    findVerificationToken: jest.fn(),
    deleteVerificationToken: jest.fn(),
    deleteVerificationTokensForUser: jest.fn(),
    markEmailVerified: jest.fn(),
  };
}


function createContext(cookies: Record<string, string>): { context: ExecutionContext; request: AuthenticatedRequest } {
  const request = { cookies } as unknown as AuthenticatedRequest;
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return { context, request };
}

function createGuard(repository: MockedRepository): AuthGuard {
  return new AuthGuard(new AuthService(repository as unknown as AuthRepository));
}

describe('AuthGuard', () => {
  it('rejects a request with no session cookie without querying the database', async () => {
    const repository = createRepository(null);
    const { context } = createContext({});

    await expect(createGuard(repository).canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.findSessionWithUser).not.toHaveBeenCalled();
  });

  it('rejects an unknown session id', async () => {
    const repository = createRepository(null);
    const { context } = createContext({ session: 'unknown-id' });

    await expect(createGuard(repository).canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.findSessionWithUser).toHaveBeenCalledWith('unknown-id');
  });

  it('rejects an expired session and deletes it', async () => {
    const repository = createRepository({ expiresAt: new Date(Date.now() - 1), user: USER });
    const { context } = createContext({ session: 'expired-id' });

    await expect(createGuard(repository).canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.deleteSession).toHaveBeenCalledWith('expired-id');
  });

  it('attaches the current user to the request for a live session', async () => {
    const repository = createRepository({ expiresAt: new Date(Date.now() + SESSION_TTL_MS), user: USER });
    const { context, request } = createContext({ session: 'live-id' });

    await expect(createGuard(repository).canActivate(context)).resolves.toBe(true);
    expect(request.currentUser).toEqual(USER);
  });
});
