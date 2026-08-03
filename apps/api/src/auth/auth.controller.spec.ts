import { randomUUID } from 'node:crypto';
import { PublicUserSchema } from '@booking/core';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from './auth.controller';
import {
  AuthRepository,
  EmailAlreadyTakenError,
  type NewSession,
  type NewUser,
  type SessionRow,
  type UserRow,
  type UserWithPasswordRow,
} from './auth.repository';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_SECURE } from './session-cookie';

const VALID_BODY = { name: 'Іван', email: 'ivan@x.com', password: 'correct horse' };

function withoutPassword({ id, name, email, emailVerifiedAt }: UserWithPasswordRow): UserRow {
  return { id, name, email, emailVerifiedAt };
}

/** Stands in for Postgres, including the users_email_key collision. */
class InMemoryAuthRepository extends AuthRepository {
  private readonly usersByEmail = new Map<string, UserWithPasswordRow>();
  private readonly usersById = new Map<string, UserWithPasswordRow>();
  private readonly sessions = new Map<string, NewSession>();

  async createUser(user: NewUser): Promise<UserRow> {
    if (this.usersByEmail.has(user.email)) {
      throw new EmailAlreadyTakenError();
    }
    const created: UserWithPasswordRow = { ...user, id: randomUUID(), emailVerifiedAt: null };
    this.usersByEmail.set(created.email, created);
    this.usersById.set(created.id, created);
    return withoutPassword(created);
  }

  async findUserByEmail(email: string): Promise<UserWithPasswordRow | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async createSession(session: NewSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async findSessionWithUser(sessionId: string): Promise<SessionRow | null> {
    const session = this.sessions.get(sessionId);
    const user = session && this.usersById.get(session.userId);
    return session && user ? { expiresAt: session.expiresAt, user: withoutPassword(user) } : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  storedEmails(): string[] {
    return [...this.usersByEmail.keys()];
  }

  expireEverySession(): void {
    for (const [id, session] of this.sessions) {
      this.sessions.set(id, { ...session, expiresAt: new Date(Date.now() - 1) });
    }
  }
}

async function createApp(repository: AuthRepository, cookieSecure: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      AuthService,
      { provide: AuthRepository, useValue: repository },
      { provide: SESSION_COOKIE_SECURE, useValue: cookieSecure },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  return app;
}

function setCookieHeader(response: request.Response): string {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (cookie === undefined) {
    throw new Error('response carried no session cookie');
  }
  return cookie;
}

function cookiePair(response: request.Response): string {
  return setCookieHeader(response).split(';')[0];
}

describe('AuthController', () => {
  let repository: InMemoryAuthRepository;
  let app: INestApplication;

  beforeEach(async () => {
    repository = new InMemoryAuthRepository();
    app = await createApp(repository, false);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('creates the user, returns 201 with a PublicUser and sets the session cookie', async () => {
      const response = await request(app.getHttpServer()).post('/api/auth/register').send(VALID_BODY).expect(201);

      const body = response.body as { user: unknown };
      expect(() => PublicUserSchema.parse(body.user)).not.toThrow();
      expect(body.user).toMatchObject({ name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: null });
      expect(body).not.toHaveProperty('user.passwordHash');

      const cookie = setCookieHeader(response);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=2592000');
      expect(cookie).not.toContain('Secure');
    });

    it('normalises the email, so IVAN@x.com and " ivan@x.com " are the same account', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...VALID_BODY, email: ' IVAN@x.com ' })
        .expect(201);

      expect(repository.storedEmails()).toEqual(['ivan@x.com']);

      const conflict = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...VALID_BODY, email: 'ivan@X.COM' })
        .expect(409);

      expect(conflict.body).toEqual({ statusCode: 409, message: 'Користувач з таким email вже існує' });
    });

    it('rejects a 7-character password with a Ukrainian message under `password`', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...VALID_BODY, password: '1234567' })
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        errors: { password: ['Пароль має містити щонайменше 8 символів'] },
      });
    });

    it('reports every invalid field at once', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: '', email: 'nope', password: 'short' })
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        errors: {
          name: ["Вкажіть ім'я"],
          email: ['Некоректний email'],
          password: ['Пароль має містити щонайменше 8 символів'],
        },
      });
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/api/auth/register').send(VALID_BODY).expect(201);
    });

    it('returns 200 with the user and a session cookie for correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'IVAN@x.com', password: VALID_BODY.password })
        .expect(200);

      expect((response.body as { user: { email: string } }).user.email).toBe('ivan@x.com');
      expect(setCookieHeader(response)).toContain('HttpOnly');
    });

    it('answers an unknown email and a wrong password with the same 401 body', async () => {
      const unknownEmail = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@x.com', password: VALID_BODY.password })
        .expect(401);

      const wrongPassword = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ivan@x.com', password: 'not the password' })
        .expect(401);

      expect(unknownEmail.body).toEqual({ statusCode: 401, message: 'Невірний email або пароль' });
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it('rejects a missing password as a 400 field error, not a 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ivan@x.com' })
        .expect(400);

      expect(response.body).toEqual({ statusCode: 400, errors: { password: ['Вкажіть пароль'] } });
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 200 with { user: null } without a cookie', async () => {
      const response = await request(app.getHttpServer()).get('/api/auth/me').expect(200);

      expect(response.body).toEqual({ user: null });
    });

    it('returns 200 with { user: null } for an unknown session id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `${SESSION_COOKIE_NAME}=made-up`)
        .expect(200);

      expect(response.body).toEqual({ user: null });
    });

    it('returns the current user for a live session', async () => {
      const registered = await request(app.getHttpServer()).post('/api/auth/register').send(VALID_BODY).expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookiePair(registered))
        .expect(200);

      expect(response.body).toEqual(registered.body);
    });

    it('returns 200 with { user: null } once the session has expired', async () => {
      const registered = await request(app.getHttpServer()).post('/api/auth/register').send(VALID_BODY).expect(201);
      repository.expireEverySession();

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookiePair(registered))
        .expect(200);

      expect(response.body).toEqual({ user: null });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 204 and clears the cookie even without a session', async () => {
      const response = await request(app.getHttpServer()).post('/api/auth/logout').expect(204);

      expect(setCookieHeader(response)).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('invalidates the session so /me reports { user: null }', async () => {
      const registered = await request(app.getHttpServer()).post('/api/auth/register').send(VALID_BODY).expect(201);
      const cookie = cookiePair(registered);

      await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);
      const response = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(200);

      expect(response.body).toEqual({ user: null });
    });
  });

  describe('with COOKIE_SECURE=true', () => {
    it('adds the Secure flag to the session cookie', async () => {
      const secureApp = await createApp(new InMemoryAuthRepository(), true);
      try {
        const response = await request(secureApp.getHttpServer())
          .post('/api/auth/register')
          .send(VALID_BODY)
          .expect(201);

        expect(setCookieHeader(response)).toContain('Secure');
      } finally {
        await secureApp.close();
      }
    });
  });
});
