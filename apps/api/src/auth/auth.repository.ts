export interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
}

export interface UserWithPasswordRow extends UserRow {
  passwordHash: string;
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
}

export interface NewSession {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface SessionRow {
  expiresAt: Date;
  user: UserRow;
}

/**
 * Raised by any `AuthRepository` whose store rejects a second user with the same
 * email. Translating at the persistence boundary keeps SQLSTATE knowledge inside
 * the Drizzle implementation, and lets the in-memory test double signal the same
 * condition without having to imitate a driver error shape — the divergence that
 * would otherwise let a broken production code path stay green in unit tests.
 */
export class EmailAlreadyTakenError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyTakenError';
  }
}

/**
 * Persistence boundary for authentication. Declared as an abstract class so it
 * doubles as a Nest DI token: production binds the Drizzle implementation,
 * unit tests bind an in-memory one and never touch Postgres.
 */
export abstract class AuthRepository {
  /** @throws EmailAlreadyTakenError when the email is already registered. */
  abstract createUser(user: NewUser): Promise<UserRow>;
  abstract findUserByEmail(email: string): Promise<UserWithPasswordRow | null>;
  abstract createSession(session: NewSession): Promise<void>;
  abstract findSessionWithUser(sessionId: string): Promise<SessionRow | null>;
  abstract deleteSession(sessionId: string): Promise<void>;
}
