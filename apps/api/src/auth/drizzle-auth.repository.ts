import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { getConnection } from '../db/connection';
import { QueryFailedError, runQuery, UNIQUE_VIOLATION } from '../db/driver-errors';
import { emailVerificationTokens, sessions, users } from '../db/schema';
import {
  AuthRepository,
  EmailAlreadyTakenError,
  type NewSession,
  type NewUser,
  type SessionRow,
  type UserRow,
  type UserWithPasswordRow,
  type VerificationTokenRow,
} from './auth.repository';

// password_hash is deliberately absent: only the login path may read it.
const USER_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  emailVerifiedAt: users.emailVerifiedAt,
} as const;

@Injectable()
export class DrizzleAuthRepository extends AuthRepository {
  // Resolved per call so building the module never opens a connection pool.
  private get db() {
    return getConnection().db;
  }

  async createUser(user: NewUser): Promise<UserRow> {
    try {
      const [created] = await runQuery('createUser', () =>
        this.db.insert(users).values(user).returning(USER_COLUMNS),
      );
      return created;
    } catch (error) {
      // users_email_key is the only unique constraint on the table, and the email
      // was lowercased and trimmed by EmailSchema before it got here, so a
      // collision means the address is taken regardless of how it was cased.
      if (error instanceof QueryFailedError && error.code === UNIQUE_VIOLATION) {
        throw new EmailAlreadyTakenError();
      }
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<UserWithPasswordRow | null> {
    const [found] = await runQuery('findUserByEmail', () =>
      this.db
        .select({ ...USER_COLUMNS, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.email, email))
        .limit(1),
    );
    return found ?? null;
  }

  async findUserById(userId: string): Promise<UserRow | null> {
    const [found] = await runQuery('findUserById', () =>
      this.db.select(USER_COLUMNS).from(users).where(eq(users.id, userId)).limit(1),
    );
    return found ?? null;
  }

  async createSession(session: NewSession): Promise<void> {
    await runQuery('createSession', () => this.db.insert(sessions).values(session));
  }

  async findSessionWithUser(sessionId: string): Promise<SessionRow | null> {
    const [found] = await runQuery('findSessionWithUser', () =>
      this.db
        .select({ expiresAt: sessions.expiresAt, user: USER_COLUMNS })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.id, sessionId))
        .limit(1),
    );
    return found ?? null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await runQuery('deleteSession', () => this.db.delete(sessions).where(eq(sessions.id, sessionId)));
  }

  async createVerificationToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    await runQuery('createVerificationToken', () =>
      this.db.insert(emailVerificationTokens).values({ token, userId, expiresAt }),
    );
  }

  async findVerificationToken(token: string): Promise<VerificationTokenRow | null> {
    const [found] = await runQuery('findVerificationToken', () =>
      this.db
        .select({
          token: emailVerificationTokens.token,
          userId: emailVerificationTokens.userId,
          expiresAt: emailVerificationTokens.expiresAt,
        })
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.token, token))
        .limit(1),
    );
    return found ?? null;
  }

  async deleteVerificationToken(token: string): Promise<void> {
    await runQuery('deleteVerificationToken', () =>
      this.db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token)),
    );
  }

  async deleteVerificationTokensForUser(userId: string): Promise<void> {
    await runQuery('deleteVerificationTokensForUser', () =>
      this.db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId)),
    );
  }

  async markEmailVerified(userId: string): Promise<void> {
    await runQuery('markEmailVerified', () =>
      this.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId)),
    );
  }
}

