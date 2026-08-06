import { randomBytes } from 'node:crypto';
import type { LoginInput, PublicUser, RegisterInput } from '@booking/core';
import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import {
  authenticationRequired,
  emailAlreadyRegistered,
  invalidCredentials,
  invalidOrExpiredVerificationToken,
} from './auth.errors';
import { AuthRepository, EmailAlreadyTakenError, type NewUser, type UserRow } from './auth.repository';
import { SESSION_TTL_MS } from './session-cookie';

const BCRYPT_COST = 12;
const SESSION_ID_BYTES = 32;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface AuthResult {
  user: PublicUser;
  sessionId: string;
}

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  };
}

// Comparing an unknown email against a throwaway hash costs the same as comparing a
// real one, so response time does not reveal which addresses are registered. Built
// once per process and from random input, so it can never match a real password.
let dummyPasswordHash: Promise<string> | undefined;
function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= hash(randomBytes(SESSION_ID_BYTES).toString('base64url'), BCRYPT_COST);
  return dummyPasswordHash;
}

@Injectable()
export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const passwordHash = await hash(input.password, BCRYPT_COST);
    const user = await this.insertUser({ name: input.name, email: input.email, passwordHash });
    await this.generateAndLogVerificationToken(user.id);
    return { user: toPublicUser(user), sessionId: await this.startSession(user.id) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const found = await this.repository.findUserByEmail(input.email);
    const passwordMatches = await compare(input.password, found?.passwordHash ?? (await getDummyPasswordHash()));
    if (!found || !passwordMatches) {
      throw invalidCredentials();
    }
    return { user: toPublicUser(found), sessionId: await this.startSession(found.id) };
  }

  /** Idempotent: a missing or already-deleted session is not an error. */
  async logout(sessionId: string | undefined): Promise<void> {
    if (sessionId) {
      await this.repository.deleteSession(sessionId);
    }
  }

  async resolveSession(sessionId: string): Promise<PublicUser> {
    const user = await this.resolveSessionOrNull(sessionId);
    if (!user) {
      throw authenticationRequired();
    }
    return user;
  }

  /** Same lookup as resolveSession, but for callers where an anonymous visitor is not an error. */
  async resolveSessionOrNull(sessionId: string): Promise<PublicUser | null> {
    const session = await this.repository.findSessionWithUser(sessionId);
    if (!session) {
      return null;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.repository.deleteSession(sessionId);
      return null;
    }
    return toPublicUser(session.user);
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenRow = await this.repository.findVerificationToken(token);
    if (!tokenRow || tokenRow.expiresAt.getTime() <= Date.now()) {
      throw invalidOrExpiredVerificationToken();
    }
    const user = await this.repository.findUserById(tokenRow.userId);
    if (user && !user.emailVerifiedAt) {
      await this.repository.markEmailVerified(user.id);
    }
    await this.repository.deleteVerificationToken(token);
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    await this.generateAndLogVerificationToken(userId);
  }

  private async generateAndLogVerificationToken(userId: string): Promise<string> {
    await this.repository.deleteVerificationTokensForUser(userId);
    const token = randomBytes(SESSION_ID_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await this.repository.createVerificationToken(token, userId, expiresAt);
    const url = `http://localhost:3000/api/auth/verify/${token}`;
    console.log(url);
    return token;
  }

  private async insertUser(user: NewUser): Promise<UserRow> {
    try {
      return await this.repository.createUser(user);
    } catch (error) {
      if (error instanceof EmailAlreadyTakenError) {
        throw emailAlreadyRegistered();
      }
      throw error;
    }
  }

  private async startSession(userId: string): Promise<string> {
    const id = randomBytes(SESSION_ID_BYTES).toString('base64url');
    await this.repository.createSession({ id, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
    return id;
  }
}

