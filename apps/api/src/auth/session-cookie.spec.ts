import type { Request } from 'express';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  clearedSessionCookieOptions,
  readSessionCookie,
  sessionCookieOptions,
} from './session-cookie';

function requestWith(cookies: unknown): Request {
  return { cookies } as Request;
}

describe('sessionCookieOptions', () => {
  it('is httpOnly, sameSite lax, path / and lives for 30 days', () => {
    expect(sessionCookieOptions(false)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('takes the Secure flag from the configured value rather than assuming it', () => {
    expect(sessionCookieOptions(true).secure).toBe(true);
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});

describe('clearedSessionCookieOptions', () => {
  it('matches the flags the cookie was set with, minus the lifetime', () => {
    expect(clearedSessionCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
    });
  });
});

describe('readSessionCookie', () => {
  it('returns the session cookie value', () => {
    expect(readSessionCookie(requestWith({ [SESSION_COOKIE_NAME]: 'abc' }))).toBe('abc');
  });

  it('returns undefined when the cookie is absent, empty or not a string', () => {
    expect(readSessionCookie(requestWith({}))).toBeUndefined();
    expect(readSessionCookie(requestWith(undefined))).toBeUndefined();
    expect(readSessionCookie(requestWith({ [SESSION_COOKIE_NAME]: '' }))).toBeUndefined();
    expect(readSessionCookie(requestWith({ [SESSION_COOKIE_NAME]: ['a', 'b'] }))).toBeUndefined();
  });
});
