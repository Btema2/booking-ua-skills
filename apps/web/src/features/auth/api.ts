import type { LoginInput, PublicUser, RegisterInput } from '@booking/core';
import { ApiError, HTTP_UNAUTHORIZED, apiRequest, postJson } from '../../lib/api';

type AuthResponse = { user: PublicUser };

/** Resolves to `null` for an anonymous visitor; only real faults reject. */
export async function fetchCurrentUser(): Promise<PublicUser | null> {
  try {
    const { user } = await apiRequest<AuthResponse>('/auth/me');
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === HTTP_UNAUTHORIZED) {
      return null;
    }
    throw error;
  }
}

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const { user } = await postJson<AuthResponse>('/auth/register', input);
  return user;
}

export async function loginUser(input: LoginInput): Promise<PublicUser> {
  const { user } = await postJson<AuthResponse>('/auth/login', input);
  return user;
}

export function logoutUser(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}
