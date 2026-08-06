import type { LoginInput, PublicUser, RegisterInput } from '@booking/core';
import { apiRequest, postJson } from '../../lib/api';

type AuthResponse = { user: PublicUser };

/** The server answers 200 with `user: null` for an anonymous visitor; only real faults reject. */
export async function fetchCurrentUser(): Promise<PublicUser | null> {
  const { user } = await apiRequest<{ user: PublicUser | null }>('/auth/me');
  return user;
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

export function verifyEmail(token: string): Promise<void> {
  return apiRequest<void>(`/auth/verify/${token}`, { method: 'POST' });
}

export function resendVerificationToken(): Promise<void> {
  return apiRequest<void>('/auth/verify/resend', { method: 'POST' });
}

