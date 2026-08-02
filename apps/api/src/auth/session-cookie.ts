import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE_NAME = 'session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** DI token carrying `env.COOKIE_SECURE`; bound in AuthModule. */
export const SESSION_COOKIE_SECURE = Symbol('SESSION_COOKIE_SECURE');

const BASE_OPTIONS = { httpOnly: true, sameSite: 'lax', path: '/' } as const satisfies CookieOptions;

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { ...BASE_OPTIONS, secure, maxAge: SESSION_TTL_MS };
}

// A browser only drops a cookie when the clearing flags match the ones it was set
// with, so these stay in step with sessionCookieOptions minus the lifetime.
export function clearedSessionCookieOptions(secure: boolean): CookieOptions {
  return { ...BASE_OPTIONS, secure };
}

export function readSessionCookie(request: Request): string | undefined {
  const value: unknown = request.cookies?.[SESSION_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
