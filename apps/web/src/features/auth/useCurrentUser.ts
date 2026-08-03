import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from './api';

export const currentUserQueryKey = ['auth', 'me'] as const;

/**
 * The single source of truth for "who is signed in".
 * `retry: false` because an anonymous visitor (`user: null`) is a normal state, not a flake.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    retry: false,
  });
}
